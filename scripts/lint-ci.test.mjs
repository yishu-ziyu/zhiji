import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { compareDiagnostics, fingerprint } from "./lint-ci.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const diagnostic = { ruleId: "example", severity: 2, line: 1, column: 1, message: "full diagnostic\ncontext" };
const baseline = [{ key: fingerprint("example.ts", diagnostic), count: 1 }];
const results = (...messages) => [{ filePath: path.join(root, "example.ts"), messages }];
test("known lint debt is counted; resolved debt does not hide new errors", () => {
  assert.equal(compareDiagnostics(results(diagnostic), baseline).known, 1);
  assert.equal(compareDiagnostics(results(), baseline).resolved, 1);
  assert.equal(compareDiagnostics(results({ ...diagnostic, message: "new error" }), baseline).unexpected.length, 1);
});
test("additional occurrences and changed full messages fail", () => {
  assert.equal(compareDiagnostics(results(diagnostic, diagnostic), baseline).unexpected.length, 1);
  assert.equal(compareDiagnostics(results({ ...diagnostic, message: "full diagnostic\nchanged context" }), baseline).unexpected.length, 1);
});
test("fatal parser diagnostics cannot be baselined", () => {
  assert.equal(compareDiagnostics(results({ ...diagnostic, fatal: true }), baseline).unexpected.length, 1);
});
test("new rules, files and locations fail", () => {
  assert.equal(compareDiagnostics(results({ ...diagnostic, ruleId: "new-rule" }), baseline).unexpected.length, 1);
  assert.equal(compareDiagnostics([{ filePath: path.join(root, "new.ts"), messages: [diagnostic] }], baseline).unexpected.length, 1);
  assert.equal(compareDiagnostics(results({ ...diagnostic, line: 2 }), baseline).unexpected.length, 1);
});
test("diagnostic codeframes are portable between checkout roots", () => {
  const first = { ...diagnostic, message: `/first/checkout/example.ts:1\nfull diagnostic` };
  const second = { ...diagnostic, message: `/runner/checkout/example.ts:1\nfull diagnostic` };
  assert.equal(fingerprint("example.ts", first, "/first/checkout"), fingerprint("example.ts", second, "/runner/checkout"));
});
