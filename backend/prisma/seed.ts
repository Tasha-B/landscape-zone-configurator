// `npm run db:seed`: loads the demo office. Safe to run again: it replaces
// the demo plan and leaves other plans alone. With `-- --if-missing` it loads
// the demo plan only if it is not there, and leaves an edited one as it is.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { DEMO_PLAN_ID, seedDemoPlan, seedDemoPlanIfMissing } from "./demo-plan.js";

// prisma db seed passes on the environment that prisma.config.ts loaded
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");
const onlyIfMissing = process.argv.includes("--if-missing");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
try {
  const loaded = onlyIfMissing ? await seedDemoPlanIfMissing(prisma) : await seedDemoPlan(prisma).then(() => true);
  if (loaded) {
    const zones = await prisma.zone.count({ where: { planId: DEMO_PLAN_ID } });
    console.log(`Seeded the demo plan ${DEMO_PLAN_ID} with ${zones} zones`);
  } else {
    console.log(`The demo plan ${DEMO_PLAN_ID} is already there; left as it is`);
  }
} finally {
  await prisma.$disconnect();
}
