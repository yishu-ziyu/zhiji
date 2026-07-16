/**
 * FC-OPC iBot — competition Electron Main.
 * Lifecycle only: loopback Next standalone + sandboxed BrowserWindow.
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow, dialog, utilityProcess } = require("electron");
const runtime = require("./runtime.cjs");

/** @type {Electron.BrowserWindow | null} */
let mainWindow = null;
/** @type {Electron.UtilityProcess | null} */
let serverProcess = null;
let isQuitting = false;
let allocatedPort = 0;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function appendLog(logFile, line) {
  try {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    const safe = runtime.redactForLog(line);
    fs.appendFileSync(
      logFile,
      `[${new Date().toISOString()}] ${safe}\n`,
      "utf8",
    );
  } catch {
    // best-effort
  }
}

function showFatalAndExit(message, logFile) {
  appendLog(logFile, `FATAL: ${message}`);
  try {
    dialog.showErrorBox("FC-OPC iBot 无法启动", message);
  } catch {
    console.error(message);
  }
  setTimeout(() => {
    app.exit(1);
  }, 100);
}

/**
 * Production ignores FC_OPC_DESKTOP_DEV_URL.
 * Dev (unpackaged) may load it after health check.
 */
function resolveLoadUrl(port) {
  if (!app.isPackaged) {
    const devUrl = process.env.FC_OPC_DESKTOP_DEV_URL;
    if (devUrl && typeof devUrl === "string") {
      try {
        const u = new URL(devUrl);
        if (u.hostname === "127.0.0.1" && u.protocol === "http:") {
          // Dev may use fixed 3331; still only loopback
          const entry = devUrl.replace(/\/$/, "") + "/track/knowledge";
          return entry.includes("/track/knowledge")
            ? entry
            : `${devUrl.replace(/\/$/, "")}/track/knowledge`;
        }
      } catch {
        // ignore invalid
      }
    }
  }
  return runtime.knowledgeEntryUrl(port);
}

async function startCapabilityServer(paths, allowedEnv, logFile) {
  const port = await runtime.chooseLoopbackPort();
  allocatedPort = port;

  if (!fs.existsSync(paths.serverEntry)) {
    throw new Error(`standalone server missing: ${paths.serverEntry}`);
  }

  fs.mkdirSync(paths.knowledgeDir, { recursive: true });

  // P0: never spread process.env — only minimal + allowlisted keys.
  const env = runtime.buildUtilityProcessEnv({
    allowedEnv,
    port,
    knowledgeDir: paths.knowledgeDir,
    pathEnv: process.env.PATH,
    homeEnv: process.env.HOME,
    tmpDir: process.env.TMPDIR,
    lang: process.env.LANG,
  });
  runtime.assertEnvHasNoForbiddenKeys(env);
  appendLog(
    logFile,
    `starting utilityProcess port=${port} knowledgeDir=configured ${runtime.formatConfigPresence(allowedEnv)}`,
  );

  serverProcess = utilityProcess.fork(paths.serverEntry, [], {
    cwd: paths.runtimeDir,
    env,
    stdio: "pipe",
    serviceName: "FC-OPC Local Capability",
  });

  if (serverProcess.stdout) {
    serverProcess.stdout.on("data", (buf) => {
      appendLog(logFile, `[server:out] ${buf.toString("utf8").trimEnd()}`);
    });
  }
  if (serverProcess.stderr) {
    serverProcess.stderr.on("data", (buf) => {
      appendLog(logFile, `[server:err] ${buf.toString("utf8").trimEnd()}`);
    });
  }

  serverProcess.on("exit", (code) => {
    appendLog(logFile, `utilityProcess exit code=${code}`);
    serverProcess = null;
    if (!isQuitting && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.loadURL(
        "data:text/html;charset=utf-8," +
          encodeURIComponent(
            `<!doctype html><meta charset="utf-8"/><title>服务已停止</title>
            <body style="font-family:system-ui;padding:2rem;background:#111;color:#f6f6f3">
            <h1>本机能力层已退出</h1>
            <p>本地服务意外停止（code ${code ?? "?"}）。这不是“已读懂”。请退出后重新打开应用。</p>
            </body>`,
          ),
      );
      if (!mainWindow.isVisible()) mainWindow.show();
    }
  });

  const health = runtime.healthCheckUrl(port);
  const ready = await runtime.waitForHttpOk(health, {
    timeoutMs: 20_000,
    intervalMs: 250,
  });
  if (!ready.ok) {
    stopServer();
    throw new Error(
      `本机能力层未在 20 秒内就绪：${ready.reason || "health check failed"} (${health})`,
    );
  }
  appendLog(logFile, `health ok status=${ready.status}`);
  return port;
}

function stopServer() {
  if (serverProcess) {
    try {
      serverProcess.kill();
    } catch {
      // ignore
    }
    serverProcess = null;
  }
}

function createMainWindow(preloadPath, port, logFile) {
  const opts = runtime.createWindowOptions(preloadPath);
  mainWindow = new BrowserWindow(opts);

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!runtime.isAllowedAppUrl(url, port)) {
      event.preventDefault();
      const safe = runtime.decideWindowOpen(url).blockedUrlSafe;
      appendLog(logFile, `blocked navigation: ${safe}`);
    }
  });

  // P1: never open new windows (even same-origin).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const decision = runtime.decideWindowOpen(url);
    appendLog(logFile, `blocked window open: ${decision.blockedUrlSafe}`);
    return { action: "deny" };
  });

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
    }
  });

  const loadUrl = resolveLoadUrl(port);
  appendLog(logFile, `loadURL ${loadUrl}`);
  void mainWindow.loadURL(loadUrl);
}

async function boot() {
  await app.whenReady();

  const userDataDir = app.getPath("userData");
  // Packaged: resources next to app.asar or Contents/Resources/app
  // unpackaged: repo root when electron . is run from project
  const appPath = app.isPackaged
    ? path.join(process.resourcesPath, "app")
    : path.resolve(__dirname, "..");

  // When packaged with packager, app contents are the stage root
  const packagedAppPath = app.isPackaged
    ? app.getAppPath()
    : path.resolve(__dirname, "..");

  const paths = runtime.resolveDesktopPaths({
    userDataDir,
    appPath: packagedAppPath,
  });

  // BYOK: packaged app only reads userData .env.local (user-filled).
  // Unpacked dev may also use allowlisted process env. Never full process.env.
  const fileEnv = runtime.readEnvFileIfExists(paths.envFile);
  const allowedEnv = runtime.loadDesktopSecrets({
    isPackaged: app.isPackaged,
    processEnv: process.env,
    fileContents: fileEnv,
  });
  const logFile = paths.logFile;
  appendLog(logFile, `boot packaged=${app.isPackaged} appPath=${packagedAppPath}`);
  appendLog(
    logFile,
    `byok secrets ${runtime.formatConfigPresence(allowedEnv)} source=${app.isPackaged ? "userData-file-only" : "file+allowlisted-process"}`,
  );

  try {
    let port;
    if (!app.isPackaged && process.env.FC_OPC_DESKTOP_DEV_URL) {
      // Dev attach: expect external Next already running on 3331
      const devPort = Number(new URL(process.env.FC_OPC_DESKTOP_DEV_URL).port || 3331);
      allocatedPort = devPort;
      const ready = await runtime.waitForHttpOk(runtime.healthCheckUrl(devPort), {
        timeoutMs: 15_000,
        intervalMs: 250,
      });
      if (!ready.ok) {
        throw new Error(
          `开发模式健康检查失败：请先在 127.0.0.1:${devPort} 启动 Next。${ready.reason}`,
        );
      }
      port = devPort;
    } else {
      port = await startCapabilityServer(paths, allowedEnv, logFile);
    }

    const preloadPath = path.join(__dirname, "preload.cjs");
    createMainWindow(preloadPath, port, logFile);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    showFatalAndExit(msg, logFile);
  }
}

app.on("before-quit", (event) => {
  if (isQuitting) return;
  isQuitting = true;
  if (serverProcess) {
    event.preventDefault();
    const child = serverProcess;
    stopServer();
    // Give utility process a moment then quit
    setTimeout(() => {
      app.exit(0);
    }, 500);
    void child;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && allocatedPort) {
    const preloadPath = path.join(__dirname, "preload.cjs");
    const userDataDir = app.getPath("userData");
    const logFile = path.join(userDataDir, "logs", "desktop.log");
    createMainWindow(preloadPath, allocatedPort, logFile);
  }
});

void boot();
