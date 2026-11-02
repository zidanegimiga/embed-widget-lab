import { describe, expect, it } from 'vitest';
import { clampAnchor, DEFAULT_ANCHOR, parseAnchor, toAnchor } from './anchor';

const viewport = { width: 1440, height: 900 };
const panel = { width: 340, height: 400 };

describe('toAnchor', () => {
  it('anchors to the top-left corner when dropped in the top-left quarter', () => {
    expect(toAnchor(100, 50, panel, viewport)).toEqual({ h: 'left', x: 100, v: 'top', y: 50 });
  });

  it('anchors to the bottom-right corner, measured from those edges', () => {
    // Panel occupies x 1000..1340 and y 400..800: 100px from the right, 100px from the bottom.
    expect(toAnchor(1000, 400, panel, viewport)).toEqual({ h: 'right', x: 100, v: 'bottom', y: 100 });
  });

  it('decides by the centre of the panel, not its top-left point', () => {
    // Left edge is left of centre, but the panel's centre (650 + 170 = 820) is right of it.
    expect(toAnchor(650, 50, panel, viewport).h).toBe('right');
  });
});

describe('clampAnchor', () => {
  it('keeps the panel fully inside the viewport', () => {
    expect(clampAnchor({ h: 'left', x: 5000, v: 'top', y: -40 }, panel, viewport)).toEqual({
      h: 'left',
      x: 1100,
      v: 'top',
      y: 0,
    });
  });

  it('never returns negative offsets when the viewport is smaller than the panel', () => {
    const tiny = { width: 200, height: 200 };
    expect(clampAnchor(DEFAULT_ANCHOR, panel, tiny)).toMatchObject({ x: 0, y: 0 });
  });
});

describe('parseAnchor', () => {
  it('opens bottom-right by default', () => {
    expect(parseAnchor(null)).toEqual({ h: 'right', x: 24, v: 'bottom', y: 24 });
  });

  it('restores a valid saved anchor', () => {
    const saved = { h: 'left', x: 40, v: 'top', y: 80 };
    expect(parseAnchor(JSON.stringify(saved))).toEqual(saved);
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['the old top-left format', JSON.stringify({ x: 10, y: 10 })],
    ['an unknown corner', JSON.stringify({ h: 'middle', x: 1, v: 'top', y: 1 })],
    ['a non-numeric offset', JSON.stringify({ h: 'left', x: 'far', v: 'top', y: 1 })],
  ])('falls back to the default for %s', (_name, raw) => {
    expect(parseAnchor(raw)).toEqual(DEFAULT_ANCHOR);
  });
});
