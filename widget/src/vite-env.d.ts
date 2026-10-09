/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Default event server URL baked into the bundle. Optional: data-url or init({ url }) can supply it. */
  readonly VITE_SERVER_URL?: string;
}
