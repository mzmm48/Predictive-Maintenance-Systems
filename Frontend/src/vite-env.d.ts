/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  // hier kannst du später weitere VITE_* Variablen eintragen
  // readonly VITE_SOMETHING_ELSE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
