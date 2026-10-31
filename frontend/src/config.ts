// The plan the page shows, until the editor brings routing (phase 6). The
// default is the demo office's fixed id from the database seed
// (backend/prisma/demo-plan.ts); set VITE_PLAN_ID to show another plan.
export const PLAN_ID = import.meta.env.VITE_PLAN_ID || "00000000-0000-4000-8000-000000000001";
