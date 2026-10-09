import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Position as a distance from the nearest corner. A widget dropped in the top half keeps its
 * top edge in place and grows downward; in the bottom half it keeps its bottom edge and grows
 * upward. Same for left and right. This keeps it where the user put it as the window resizes
 * and as the event list changes height.
 */
type Anchor = {
  h: 'left' | 'right';
  x: number;
  v: 'top' | 'bottom';
  y: number;
};

// v2: v1 stored top-left coordinates; ignore those.
const STORAGE_KEY = 'hmis-widget:pos:v2';
const DEFAULT_ANCHOR: Anchor = { h: 'right', x: 24, v: 'bottom', y: 24 };

function size(el: HTMLElement | null) {
  return { w: el?.offsetWidth ?? 340, h: el?.offsetHeight ?? 60 };
}

/** Converts a top-left position into an anchor on the nearest corner. */
function toAnchor(left: number, top: number, el: HTMLElement): Anchor {
  const { w, h } = size(el);
  const nearLeft = left + w / 2 < window.innerWidth / 2;
  const nearTop = top + h / 2 < window.innerHeight / 2;
  return {
    h: nearLeft ? 'left' : 'right',
    x: nearLeft ? left : window.innerWidth - left - w,
    v: nearTop ? 'top' : 'bottom',
    y: nearTop ? top : window.innerHeight - top - h,
  };
}

function clamp(anchor: Anchor, el: HTMLElement | null): Anchor {
  const { w, h } = size(el);
  return {
    ...anchor,
    x: Math.max(0, Math.min(anchor.x, window.innerWidth - w)),
    y: Math.max(0, Math.min(anchor.y, window.innerHeight - h)),
  };
}

function loadAnchor(): Anchor {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const valid =
      (saved?.h === 'left' || saved?.h === 'right') &&
      (saved?.v === 'top' || saved?.v === 'bottom') &&
      Number.isFinite(saved?.x) &&
      Number.isFinite(saved?.y);
    if (valid) return saved;
  } catch {}
  return DEFAULT_ANCHOR;
}

/** Pointer-event drag (mouse, touch, pen). Attach handleProps to the drag handle. */
export function useDraggable() {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor>(loadAnchor);
  // Where the pointer grabbed the panel, relative to the panel's top-left corner.
  const grab = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = ref.current!.getBoundingClientRect();
    grab.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // Capture keeps events coming even if the pointer leaves the handle or crosses an iframe.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!grab.current || !el) return;
    setAnchor(clamp(toAnchor(e.clientX - grab.current.x, e.clientY - grab.current.y, el), el));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!grab.current) return;
    grab.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setAnchor((a) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch {}
      return a;
    });
  }, []);

  // Keep it on screen after resizes or when restored from a bigger window.
  useEffect(() => {
    const onResize = () => setAnchor((a) => clamp(a, ref.current));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    ref,
    style: { [anchor.h]: `${anchor.x}px`, [anchor.v]: `${anchor.y}px` },
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    reclamp: () => setAnchor((a) => clamp(a, ref.current)),
  };
}
