"use client";

import { MiniMap, type MiniMapProps, type Node } from "@xyflow/react";
import type { PointerEvent } from "react";
import styles from "./hover-mini-map.module.css";

type Props = {
  nodeColor: NonNullable<MiniMapProps<Node>["nodeColor"]>;
};

export function HoverMiniMap({ nodeColor }: Props) {
  function keepOpenOnTouch(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "mouse") {
      event.currentTarget.focus({ preventScroll: true });
    }
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
