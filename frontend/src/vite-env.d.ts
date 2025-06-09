// vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CARD_IMAGE_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
