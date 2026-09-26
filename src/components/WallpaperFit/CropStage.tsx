"use client";

import { useCallback, useRef } from "react";
import { Icon } from "@/components/Icon";
import { needsUpscale } from "@/lib/wallpaperFit";
import type { WallpaperItem } from "@/lib/types";

interface CropStageProps {
  readonly item: WallpaperItem;
  readonly targetWidth: number;
  readonly targetHeight: number;
  readonly showSafeArea: boolean;
  readonly onPan: (id: number, offsetX: number, offsetY: number) => void;
  readonly onZoom: (id: number, zoom: number) => void;
  readonly onReset: (id: number) => void;
}

const MAX_ZOOM = 4;

// Live preview is pure CSS (transform: translate/scale on the <img>), never
// a canvas re-render on every drag frame - a canvas redraw per pointer-move
// on a large photo would jank, whereas the CSS transform is free regardless
// of source resolution. Only the final export (renderWallpaperCrop, in the
// hook's processOne) touches canvas. Pointer coordinate handling follows
// PdfEditCanvas.tsx's pattern: raw Pointer Events + getBoundingClientRect
// math, no drag/gesture library.
export function CropStage({ item, targetWidth, targetHeight, showSafeArea, onPan, onZoom, onReset }: CropStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  // Pointer drag state kept in a ref, not React state - it changes on every
  // pointermove and must never trigger a re-render itself (only the
  // resulting offsetX/offsetY commit does, via onPan).
  const dragState = useRef<{ pointerId: number; startClientX: number; startClientY: number; startOffsetX: number; startOffsetY: number } | null>(null);
  // Two-pointer pinch state: tracks both active pointer ids and the
  // distance between them at gesture start, so a move computes a zoom
  // delta relative to that starting distance.
  const pinchState = useRef<{ pointers: Map<number, { x: number; y: number }>; startDistance: number; startZoom: number } | null>(null);

  const scaleToFrame = Math.max(targetWidth / item.naturalWidth, targetHeight / item.naturalHeight);
  const scale = scaleToFrame * item.zoom;
  const visibleWidth = targetWidth / scale;
  const visibleHeight = targetHeight / scale;
  const maxOffsetPxX = Math.max(0, (item.naturalWidth - visibleWidth) / 2);
  const maxOffsetPxY = Math.max(0, (item.naturalHeight - visibleHeight) / 2);

  const displayedWidth = item.naturalWidth * scale;
  const displayedHeight = item.naturalHeight * scale;
  // Stage is always rendered at a fixed on-screen box that's proportioned
  // to the target aspect ratio (see the wrapper's aspect-ratio CSS); the
  // translate here is expressed as a fraction of the stage's own box so it
  // stays correct regardless of that box's actual rendered pixel size.
  const translateXPct = maxOffsetPxX > 0 ? (-item.offsetX * maxOffsetPxX * scale) : 0;
  const translateYPct = maxOffsetPxY > 0 ? (-item.offsetY * maxOffsetPxY * scale) : 0;

  const upscaleWarning = needsUpscale(item.naturalWidth, item.naturalHeight, targetWidth, targetHeight);
  const showOverlay = showSafeArea;

  const commitPan = useCallback(
    (deltaClientX: number, deltaClientY: number, startOffsetX: number, startOffsetY: number) => {
      const nextOffsetX = maxOffsetPxX > 0 ? startOffsetX - deltaClientX / maxOffsetPxX / scale : 0;
      const nextOffsetY = maxOffsetPxY > 0 ? startOffsetY - deltaClientY / maxOffsetPxY / scale : 0;
      onPan(item.id, Math.max(-1, Math.min(1, nextOffsetX)), Math.max(-1, Math.min(1, nextOffsetY)));
    },
    [item.id, maxOffsetPxX, maxOffsetPxY, scale, onPan]
  );

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);

    if (!pinchState.current) pinchState.current = { pointers: new Map(), startDistance: 0, startZoom: item.zoom };
    pinchState.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pinchState.current.pointers.size === 2) {
      // Second pointer just landed - switch to pinch mode, drop any
      // single-pointer drag in progress.
      dragState.current = null;
      const pts = Array.from(pinchState.current.pointers.values());
      pinchState.current.startDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchState.current.startZoom = item.zoom;
    } else {
      dragState.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startOffsetX: item.offsetX,
        startOffsetY: item.offsetY,
      };
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (pinchState.current && pinchState.current.pointers.has(e.pointerId)) {
      pinchState.current.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pinchState.current && pinchState.current.pointers.size === 2) {
      const pts = Array.from(pinchState.current.pointers.values());
      const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (pinchState.current.startDistance > 0) {
        const ratio = distance / pinchState.current.startDistance;
        const nextZoom = Math.max(1, Math.min(MAX_ZOOM, pinchState.current.startZoom * ratio));
        onZoom(item.id, nextZoom);
      }
      return;
    }

    if (dragState.current && dragState.current.pointerId === e.pointerId) {
      const deltaX = e.clientX - dragState.current.startClientX;
      const deltaY = e.clientY - dragState.current.startClientY;
      commitPan(deltaX, deltaY, dragState.current.startOffsetX, dragState.current.startOffsetY);
    }
  }

  function endPointer(e: React.PointerEvent<HTMLDivElement>) {
    if (pinchState.current) pinchState.current.pointers.delete(e.pointerId);
    if (pinchState.current && pinchState.current.pointers.size < 2) pinchState.current = null;
    if (dragState.current && dragState.current.pointerId === e.pointerId) dragState.current = null;
  }

  function handleWheel(e: React.WheelEvent<HTMLDivElement>) {
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    const nextZoom = Math.max(1, Math.min(MAX_ZOOM, item.zoom * (1 + delta)));
    onZoom(item.id, nextZoom);
  }

  const isPhoneShaped = targetHeight > targetWidth * 1.3;

  return (
    <div className="crop-stage-wrap">
      <div
        ref={stageRef}
        className="crop-stage"
        style={{ aspectRatio: `${targetWidth} / ${targetHeight}` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onWheel={handleWheel}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- object URL, and the whole point is a live CSS transform preview, not next/image's fixed layout */}
        <img
          src={item.originalUrl}
          alt=""
          draggable={false}
          className="crop-stage-img"
          style={{
            width: `${displayedWidth}px`,
            height: `${displayedHeight}px`,
            transform: `translate(-50%, -50%) translate(${translateXPct}px, ${translateYPct}px)`,
          }}
        />
        {showOverlay && isPhoneShaped && (
          <div className="crop-safe-area" aria-hidden="true">
            <div className="crop-safe-area-top" />
            <div className="crop-safe-area-bottom" />
          </div>
        )}
      </div>

      {upscaleWarning && (
        <p className="crop-warning">
          <Icon name="system" className="icon icon-sm" /> This photo is smaller than the target - it&apos;ll be
          upscaled and may look soft.
        </p>
      )}

      <div className="field crop-zoom-field">
        <label htmlFor="cropZoom">Zoom</label>
        <input
          id="cropZoom"
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={item.zoom}
          onChange={(e) => onZoom(item.id, Number(e.target.value))}
        />
      </div>

      <button type="button" className="btn-text" onClick={() => onReset(item.id)}>
        Reset crop
      </button>
    </div>
  );
}
