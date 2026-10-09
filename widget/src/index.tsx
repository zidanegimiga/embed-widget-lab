import { createRoot, type Root } from 'react-dom/client';
import styles from './widget.css?inline';
import { Widget } from './Widget';
import type { WidgetConfig } from './types';

export type { WidgetConfig, HmisEvent } from './types';

let instance: { host: HTMLElement; root: Root } | null = null;

export function init(config: WidgetConfig) {
  if (instance) return; // one widget per page

  // Full-viewport layer that ignores clicks, so the host page stays usable.
  // Only the panel inside turns pointer events back on.
  const host = document.createElement('div');
  host.id = 'hmis-widget-host';
  Object.assign(host.style, {
    all: 'initial',
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '2147483647',
  });
  document.body.appendChild(host);

  // Shadow DOM: host page CSS cannot leak in, our CSS cannot leak out.
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = styles;
  const mount = document.createElement('div');
  shadow.append(style, mount);

  const root = createRoot(mount);
  root.render(<Widget config={config} />);
  instance = { host, root };
}

export function destroy() {
  if (!instance) return;
  instance.root.unmount();
  instance.host.remove();
  instance = null;
}

// Script-tag auto init: <script src=".../widget.js" data-token="...">
// data-url overrides the server URL baked in at build time (VITE_SERVER_URL).
// currentScript is only set while the script is first executing, so read it now.
const script = typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null) : null;
const url = script?.dataset.url ?? import.meta.env.VITE_SERVER_URL;
if (script && url && script.dataset.autoinit !== 'false') {
  const { transport, title, token } = script.dataset;
  const start = () => init({ url, transport: transport as WidgetConfig['transport'], title, token });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
}
