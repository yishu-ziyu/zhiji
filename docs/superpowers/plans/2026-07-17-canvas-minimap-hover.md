# Canvas Mini Map Hover Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the canvas Mini Map as a quiet `56 × 42px` overview that expands to `200 × 150px` on hover, keyboard focus, or touch focus.

**Architecture:** Add a focused `HoverMiniMap` wrapper around React Flow's existing `MiniMap`. The wrapper owns presentation and accessibility while `ProjectCanvas` continues to own graph colors and data.

**Tech Stack:** React 19, TypeScript, CSS Modules, `@xyflow/react`, Playwright.

## Global Constraints

- Animate only `transform` and `opacity`; never animate layout dimensions.
- Anchor expansion at the bottom-left corner and keep all motion under 300ms.
- Preserve Mini Map panning and zooming.
- Disable transform transitions under `prefers-reduced-motion: reduce`.
- Do not alter nodes, edges, layout, or persisted project data.

---

### Task 1: Hover-expand Mini Map

**Files:**
- Create: `app/track/knowledge/components/HoverMiniMap.tsx`
- Create: `app/track/knowledge/components/hover-mini-map.module.css`
- Modify: `app/track/knowledge/components/ProjectCanvas.tsx`
- Test: `tests/e2e/minimap.spec.ts`
- Modify: `docs/product/产品清单.md`

**Interfaces:**
- Consumes: `nodeColor` with the same contract as `MiniMapProps["nodeColor"]`.
- Produces: `HoverMiniMap({ nodeColor })` and the stable test hook `data-testid="canvas-minimap-dock"`.

- [ ] **Step 1: Write the failing browser test**

```ts
import { expect, test } from "@playwright/test";

test("canvas Mini Map stays small until the user points at it", async ({ page }) => {
  await page.goto("/track/knowledge");
  const dock = page.getByTestId("canvas-minimap-dock");
  await expect(dock).toBeVisible();

  await expect.poll(async () => (await dock.boundingBox())?.width ?? 0).toBeLessThan(80);
  await dock.hover();
  await expect.poll(async () => (await dock.boundingBox())?.width ?? 0).toBeGreaterThan(180);

  await page.getByTestId("canvas-stats-bar").hover();
  await expect.poll(async () => (await dock.boundingBox())?.width ?? 0).toBeLessThan(80);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx playwright test tests/e2e/minimap.spec.ts --project=chromium
```

Expected: FAIL because `canvas-minimap-dock` does not exist.

- [ ] **Step 3: Add the focused wrapper**

```tsx
"use client";

import { MiniMap, type MiniMapProps, type Node } from "@xyflow/react";
import type { PointerEvent } from "react";
import styles from "./hover-mini-map.module.css";

type Props = {
  nodeColor: NonNullable<MiniMapProps<Node>["nodeColor"]>;
};

export function HoverMiniMap({ nodeColor }: Props) {
  function keepOpenOnTouch(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") event.currentTarget.focus({ preventScroll: true });
  }

  return (
    <div
      className={`${styles.dock} nodrag nopan`}
      data-testid="canvas-minimap-dock"
      role="region"
      aria-label="画布导航缩略图，聚焦后展开"
      tabIndex={0}
      onPointerDown={keepOpenOnTouch}
    >
      <MiniMap
        className={styles.map}
        position="bottom-left"
        pannable
        zoomable
        ariaLabel="画布方位导航"
        nodeStrokeWidth={2}
        nodeColor={nodeColor}
        maskColor="rgba(246, 246, 243, 0.72)"
      />
    </div>
  );
}
```

- [ ] **Step 4: Add transform-only motion styles**

```css
.dock {
  position: absolute;
  z-index: 5;
  bottom: 12px;
  left: 12px;
  width: 200px;
  height: 150px;
  opacity: 0.72;
  transform: scale(0.28);
  transform-origin: left bottom;
  transition:
    transform 180ms cubic-bezier(0.77, 0, 0.175, 1) 90ms,
    opacity 140ms cubic-bezier(0.23, 1, 0.32, 1) 90ms;
}

.dock:hover,
.dock:focus,
.dock:focus-within {
  opacity: 1;
  transform: scale(1);
  transition-delay: 0ms;
  outline: none;
}

.dock:focus-visible {
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.2);
}

.map {
  inset: 0 !important;
  margin: 0 !important;
  border: 1px solid #e4e4df !important;
  border-radius: 12px !important;
  overflow: hidden !important;
  background: rgba(255, 255, 255, 0.94) !important;
  box-shadow: 0 10px 24px rgba(29, 32, 37, 0.08) !important;
}

@media (prefers-reduced-motion: reduce) {
  .dock {
    transition: opacity 120ms cubic-bezier(0.23, 1, 0.32, 1);
  }
}
```

- [ ] **Step 5: Replace the inline Mini Map in `ProjectCanvas`**

Remove `MiniMap` from the `@xyflow/react` import, import `HoverMiniMap`, and replace the existing `<MiniMap ... />` block with:

```tsx
<HoverMiniMap
  nodeColor={(node) => {
    const data = node.data as GraphNodeData | undefined;
    if (!data) return "#d0d3d8";
    if (data.isCenter) return "#3d6fd8";
    if (data.ref.kind === "card") return "#6b8f71";
    if (data.ref.kind === "work_item") return "#c48a3a";
    if (data.ref.kind === "event") return "#8a7bb8";
    if (data.ref.kind === "agent") return "#3d6fd8";
    return "#9aa3ad";
  }}
/>
```

- [ ] **Step 6: Verify GREEN and quality gates**

Run:

```bash
npx playwright test tests/e2e/minimap.spec.ts --project=chromium
npx eslint app/track/knowledge/components/HoverMiniMap.tsx app/track/knowledge/components/ProjectCanvas.tsx tests/e2e/minimap.spec.ts
npx tsc --noEmit
```

Expected: all commands exit `0`.

- [ ] **Step 7: Record the product result and verify in the real preview**

Add this engineering-progress bullet under product-list item `2`:

```markdown
  - 画布 Mini Map 默认收为左下角小缩略图，仅在悬停、键盘聚焦或触屏聚焦时展开；导航能力保留，不再长驻占据画布。
```

Reload `/track/knowledge`, verify the collapsed and expanded states visually, and confirm no fresh console errors.

- [ ] **Step 8: Commit atomically without staging concurrent work**

Commit the new component and styles separately from integration/test, then commit the product ledger line. Stage only exact paths; never use `git add .`.
