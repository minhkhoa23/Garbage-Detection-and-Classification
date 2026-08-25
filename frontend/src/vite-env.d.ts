/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string

  readonly VITE_RUNTIME_CONFIG_PATH: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
