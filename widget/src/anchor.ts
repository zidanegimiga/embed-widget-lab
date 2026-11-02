// Pure position maths for useDraggable, kept separate so it can be unit tested.

/**
 * Position as a distance from the nearest corner. A widget dropped in the top half keeps its
 * top edge in place and grows downward; in the bottom half it keeps its bottom edge and grows
 * upward. Same for left and right. This keeps it where the user put it as the window resizes
 * and as the event list changes height.
 */
export type Anchor = {
  h: 'left' | 'right';
  x: number;
  v: 'top' | 'bottom';
  y: number;
};

export type Size = { width: number; height: number };
export type Viewport = { width: number; height: number };

// v2: v1 stored top-left coordinates; ignore those.
export const STORAGE_KEY = 'hmis-widget:pos:v2';
export const DEFAULT_ANCHOR: Anchor = { h: 'right', x: 24, v: 'bottom', y: 24 };

/** Converts a top-left position into an anchor on the nearest corner. */
export function toAnchor(left: number, top: number, size: Size, viewport: Viewport): Anchor {
  const nearLeft = left + size.width / 2 < viewport.width / 2;
  const nearTop = top + size.height / 2 < viewport.height / 2;
  return {
    h: nearLeft ? 'left' : 'right',
    x: nearLeft ? left : viewport.width - left - size.width,
    v: nearTop ? 'top' : 'bottom',
    y: nearTop ? top : viewport.height - top - size.height,
  };
}

/** Keeps the whole panel inside the viewport. */
export function clampAnchor(anchor: Anchor, size: Size, viewport: Viewport): Anchor {
  return {
    ...anchor,
    x: Math.max(0, Math.min(anchor.x, viewport.width - size.width)),
    y: Math.max(0, Math.min(anchor.y, viewport.height - size.height)),
  };
}

/** Reads a saved anchor, falling back to the default for missing or malformed values. */
export function parseAnchor(raw: string | null): Anchor {
  try {
    const saved = JSON.parse(raw ?? 'null');
    const valid =
      (saved?.h === 'left' || saved?.h === 'right') &&
      (saved?.v === 'top' || saved?.v === 'bottom') &&
      Number.isFinite(saved?.x) &&
      Number.isFinite(saved?.y);
    if (valid) return saved;
  } catch {}
  return DEFAULT_ANCHOR;
}
