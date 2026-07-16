import { describe, expect, it } from "vitest";
import { kindFromName, renderMarkdownLite } from "./materials";

describe("materials", () => {
  it("classifies markdown files", () => {
    expect(kindFromName("note.md")).toBe("markdown");
    expect(kindFromName("x.PDF")).toBe("other");
  });

  it("renders a heading and paragraph without raw tags", () => {
    const html = renderMarkdownLite("# 标题\n\n一段 **粗体** 和 <script>");
    expect(html).toContain("<h1>标题</h1>");
    expect(html).toContain("<strong>粗体</strong>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
