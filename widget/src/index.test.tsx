import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { destroy, init } from './index';
import { installFakeTransports } from './test/fakes';

beforeEach(() => {
  installFakeTransports();
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no history')));
});
afterEach(() => act(() => destroy()));

function host() {
  return document.getElementById('hmis-widget-host');
}

describe('init', () => {
  it('mounts inside a shadow root with its own styles', () => {
    act(() => init({ url: 'http://localhost:4000', transport: 'sse' }));

    const shadow = host()!.shadowRoot!;
    expect(shadow.querySelector('style')!.textContent).toContain('.panel');
    expect(shadow.querySelector('.panel')).not.toBeNull();
    // Nothing leaks into the host page's own DOM or head.
    expect(document.head.querySelector('style')).toBeNull();
  });

  it('lets clicks through to the host page except on the panel', () => {
    act(() => init({ url: 'http://localhost:4000', transport: 'sse' }));
    expect(host()!.style.pointerEvents).toBe('none');
  });

  it('only mounts one widget per page', () => {
    act(() => init({ url: 'http://localhost:4000', transport: 'sse' }));
    act(() => init({ url: 'http://localhost:4000', transport: 'sse' }));
    expect(document.querySelectorAll('#hmis-widget-host')).toHaveLength(1);
  });

  it('removes everything on destroy', () => {
    act(() => init({ url: 'http://localhost:4000', transport: 'sse' }));
    act(() => destroy());
    expect(host()).toBeNull();
  });
});
