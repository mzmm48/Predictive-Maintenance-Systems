/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // Optional: declare additional VITE_* variables here for TypeScript.
  // readonly VITE_SOMETHING_ELSE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
