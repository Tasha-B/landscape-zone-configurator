import type { ConfigService } from "@nestjs/config";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../config/env.js";
import { PrismaService } from "./prisma.service.js";

// Nothing listens on port 1, so these tests need no database
const UNREACHABLE_URL = "postgresql://lzc:lzc@localhost:1/lzc";

function configWith(url: string) {
  const get = vi.fn().mockReturnValue(url);
  return { config: { get } as unknown as ConfigService<Env, true>, get };
}

describe("PrismaService", () => {
  it("connects with DATABASE_URL from the validated config", async () => {
    const { config, get } = configWith(UNREACHABLE_URL);
    const prisma = new PrismaService(config);

    expect(get).toHaveBeenCalledWith("DATABASE_URL", { infer: true });
    // Refused by port 1: the client really dialled the configured URL
    await expect(prisma.$queryRaw`SELECT 1`).rejects.toMatchObject({ code: "ECONNREFUSED" });
  });

  it("disconnects when the app shuts down", async () => {
    const prisma = new PrismaService(configWith(UNREACHABLE_URL).config);
    const disconnect = vi.spyOn(prisma, "$disconnect");

    await prisma.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
