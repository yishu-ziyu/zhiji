import { describe, expect, it } from "vitest";
import {
  formatWebHitAsCardContent,
  parseAnySearchMarkdown,
} from "./client";

const SAMPLE = `## Search Results (2 results, 1119ms)

### 1. First Result Title
- **URL**: https://example.com/a
- Short snippet about A.

### 2. Second Result Title
- **URL**: https://example.com/b
- Longer snippet about B with more words.
`;

describe("parseAnySearchMarkdown", () => {
  it("extracts rank, title, url, snippet, elapsed", () => {
    const { hits, elapsedMs } = parseAnySearchMarkdown(SAMPLE);
    expect(elapsedMs).toBe(1119);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({
      rank: 1,
      title: "First Result Title",
      url: "https://example.com/a",
    });
    expect(hits[0].snippet).toContain("Short snippet");
    expect(hits[1].url).toBe("https://example.com/b");
  });

  it("returns empty on garbage", () => {
    const { hits } = parseAnySearchMarkdown("no results here");
    expect(hits).toEqual([]);
  });
});

describe("formatWebHitAsCardContent", () => {
  it("keeps url as source line", () => {
    const body = formatWebHitAsCardContent({
      rank: 1,
      title: "T",
      url: "https://example.com",
      snippet: "S",
    });
    expect(body).toContain("https://example.com");
    expect(body).toContain("AnySearch");
  });
});
