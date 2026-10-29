-- CreateEnum
CREATE TYPE "ZoneType" AS ENUM ('reception', 'meeting-room', 'open-floor', 'break-room', 'signature-corner', 'custom');

-- CreateEnum
CREATE TYPE "Lang" AS ENUM ('en', 'ru');

-- CreateTable
CREATE TABLE "FloorPlan" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "viewBox" DOUBLE PRECISION[],
    "pxPerMeter" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FloorPlan_pkey" PRIMARY KEY ("id"),
    -- Added by hand: Prisma cannot express CHECK constraints in the schema
    -- and leaves them alone in later migrations. [minX, minY, width, height]
    CONSTRAINT "FloorPlan_viewBox_length" CHECK (cardinality("viewBox") = 4)
);

-- CreateTable
CREATE TABLE "Zone" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "type" "ZoneType" NOT NULL,
    "shape" JSONB NOT NULL,
    "color" TEXT NOT NULL,
    "zIndex" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "hitPadding" INTEGER,
    "label" JSONB,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZoneContent" (
    "zoneId" UUID NOT NULL,
    "lang" "Lang" NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,

    CONSTRAINT "ZoneContent_pkey" PRIMARY KEY ("zoneId","lang")
);

-- CreateIndex
CREATE INDEX "Zone_planId_idx" ON "Zone"("planId");

-- AddForeignKey
ALTER TABLE "Zone" ADD CONSTRAINT "Zone_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FloorPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZoneContent" ADD CONSTRAINT "ZoneContent_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "Zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;
