// `npm run db:seed`: loads the demo office. Safe to run again: it replaces
// the demo plan and leaves other plans alone.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { DEMO_PLAN_ID, seedDemoPlan } from "./demo-plan.js";

// prisma db seed passes on the environment that prisma.config.ts loaded
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  await seedDemoPlan(prisma);
  const zones = await prisma.zone.count({ where: { planId: DEMO_PLAN_ID } });
  console.log(`Seeded the demo plan ${DEMO_PLAN_ID} with ${zones} zones`);
} finally {
  await prisma.$disconnect();
}
