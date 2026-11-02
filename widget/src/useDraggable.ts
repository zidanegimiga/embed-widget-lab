import { useCallback, useEffect, useRef, useState } from 'react';
import { clampAnchor, parseAnchor, STORAGE_KEY, toAnchor, type Anchor } from './anchor';

function sizeOf(el: HTMLElement | null) {
  return { width: el?.offsetWidth ?? 340, height: el?.offsetHeight ?? 60 };
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function loadAnchor(): Anchor {
  try {
    return parseAnchor(localStorage.getItem(STORAGE_KEY));
  } catch {
    return parseAnchor(null); // storage blocked: use the default
  }
}

/** Pointer-event drag (mouse, touch, pen). Attach handleProps to the drag handle. */
export function useDraggable() {
  const ref = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<Anchor>(loadAnchor);
  // Where the pointer grabbed the panel, relative to the panel's top-left corner.
  const grab = useRef<{ x: number; y: number } | null>(null);

  const clamp = useCallback((a: Anchor) => clampAnchor(a, sizeOf(ref.current), viewport()), []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const rect = ref.current!.getBoundingClientRect();
    grab.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    // Capture keeps events coming even if the pointer leaves the handle or crosses an iframe.
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!grab.current || !ref.current) return;
      const left = e.clientX - grab.current.x;
      const top = e.clientY - grab.current.y;
      setAnchor(clamp(toAnchor(left, top, sizeOf(ref.current), viewport())));
    },
    [clamp],
  );

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
    const onResize = () => setAnchor(clamp);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clamp]);

  return {
    ref,
    style: { [anchor.h]: `${anchor.x}px`, [anchor.v]: `${anchor.y}px` },
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
    reclamp: () => setAnchor(clamp),
  };
}
