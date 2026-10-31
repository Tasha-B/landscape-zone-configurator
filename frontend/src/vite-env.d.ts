/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Overrides the plan the page shows (src/config.ts)
  readonly VITE_PLAN_ID?: string;
}
