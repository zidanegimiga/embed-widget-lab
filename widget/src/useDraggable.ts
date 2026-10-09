import { useCallback, useEffect, useRef, useState } from 'react';

type Pos = { x: number; y: number };
const STORAGE_KEY = 'hmis-widget:pos';

function clamp(pos: Pos, el: HTMLElement | null): Pos {
  const w = el?.offsetWidth ?? 320;
  const h = el?.offsetHeight ?? 60;
  return {
    x: Math.max(0, Math.min(pos.x, window.innerWidth - w)),
    y: Math.max(0, Math.min(pos.y, window.innerHeight - h)),
  };
}

function loadPos(): Pos {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { x: window.innerWidth - 360, y: window.innerHeight - 480 };
}

/** Pointer-event drag (mouse, touch, pen). Attach handleProps to the drag handle. */
export function useDraggable() {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>(loadPos);
  const offset = useRef<Pos | null>(null);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = ref.current!.getBoundingClientRect();
    offset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // Capture keeps events coming even if the pointer leaves the handle or crosses an iframe.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!offset.current) return;
    setPos(clamp({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y }, ref.current));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!offset.current) return;
    offset.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    setPos((p) => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
      return p;
    });
  }, []);

  // Keep it on screen after resizes or when restored from a bigger window.
  useEffect(() => {
    const onResize = () => setPos((p) => clamp(p, ref.current));
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    ref,
    style: { transform: `translate(${pos.x}px, ${pos.y}px)` },
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    reclamp: () => setPos((p) => clamp(p, ref.current)),
  };
}
