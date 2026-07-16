/**
 * Tiny markdown → safe HTML for inspector / material preview.
 * Escape first, then lift a few patterns. No HTML pass-through.
 */

export function looksLikeMarkdown(source: string, hintName = ""): boolean {
  const name = hintName.toLowerCase();
  if (/\.(md|markdown|mdx)$/i.test(name)) return true;
  if (!source.trim()) return false;
  return (
    /^#{1,3}\s/m.test(source) ||
    /^\s*[-*]\s+\S/m.test(source) ||
    /\*\*[^*\n]+\*\*/.test(source) ||
    /```/.test(source) ||
    /^\|.+\|/m.test(source)
  );
}

function formatInline(line: string): string {
  return line
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>',
    );
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line.trim());
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.includes("|") && !isTableSeparator(t) && (t.startsWith("|") || /\|.+\|/.test(t));
}

function splitTableCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith("|")) t = t.slice(1);
  if (t.endsWith("|")) t = t.slice(0, -1);
  return t.split("|").map((cell) => cell.trim());
}

function renderTable(rows: string[]): string {
  if (rows.length === 0) return "";
  const head = splitTableCells(rows[0]!);
  const bodyRows = rows.slice(1);
  const thead = `<thead><tr>${head.map((c) => `<th>${formatInline(c)}</th>`).join("")}</tr></thead>`;
  const tbody = bodyRows.length
    ? `<tbody>${bodyRows
        .map(
          (row) =>
            `<tr>${splitTableCells(row)
              .map((c) => `<td>${formatInline(c)}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`
    : "";
  return `<table>${thead}${tbody}</table>`;
}

/** Very small markdown → safe HTML (headings, lists, code, tables, paragraphs). */
export function renderMarkdownLite(source: string): string {
  const escaped = source
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let i = 0;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        closeList();
        out.push("<pre><code>");
        inCode = true;
      }
      i += 1;
      continue;
    }
    if (inCode) {
      out.push(`${line}\n`);
      i += 1;
      continue;
    }

    if (isTableRow(line) || isTableSeparator(line)) {
      closeList();
      const tableLines: string[] = [];
      while (i < lines.length) {
        const row = lines[i] ?? "";
        if (isTableSeparator(row)) {
          i += 1;
          continue;
        }
        if (!isTableRow(row)) break;
        tableLines.push(row);
        i += 1;
      }
      if (tableLines.length > 0) out.push(renderTable(tableLines));
      continue;
    }

    if (/^### /.test(line)) {
      closeList();
      out.push(`<h3>${formatInline(line.slice(4))}</h3>`);
      i += 1;
      continue;
    }
    if (/^## /.test(line)) {
      closeList();
      out.push(`<h2>${formatInline(line.slice(3))}</h2>`);
      i += 1;
      continue;
    }
    if (/^# /.test(line)) {
      closeList();
      out.push(`<h1>${formatInline(line.slice(2))}</h1>`);
      i += 1;
      continue;
    }
    if (/^[-*] /.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${formatInline(line.slice(2))}</li>`);
      i += 1;
      continue;
    }
    closeList();
    if (line.trim() === "") {
      out.push("");
      i += 1;
      continue;
    }
    out.push(`<p>${formatInline(line)}</p>`);
    i += 1;
  }
  closeList();
  if (inCode) out.push("</code></pre>");
  return out.join("\n");
}
