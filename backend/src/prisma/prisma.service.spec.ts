import type { ConfigService } from "@nestjs/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { describe, expect, it, vi } from "vitest";
import type { Env } from "../config/env.js";
import { PrismaService } from "./prisma.service.js";

// The real adapter, wrapped so the test sees what it was built with. How a
// refused connection is reported differs between Windows and Linux, so the
// test checks the URL here instead of dialling it.
vi.mock("@prisma/adapter-pg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@prisma/adapter-pg")>();
  return {
    PrismaPg: vi.fn(function (...args: ConstructorParameters<typeof actual.PrismaPg>) {
      return new actual.PrismaPg(...args);
    }),
  };
});

// Never dialled: neither test sends a query
const DATABASE_URL = "postgresql://lzc:lzc@db.example:5432/lzc";

function configWith(url: string) {
  const get = vi.fn().mockReturnValue(url);
  return { config: { get } as unknown as ConfigService<Env, true>, get };
}

describe("PrismaService", () => {
  it("connects with DATABASE_URL from the validated config", () => {
    const { config, get } = configWith(DATABASE_URL);
    new PrismaService(config);

    expect(get).toHaveBeenCalledWith("DATABASE_URL", { infer: true });
    expect(PrismaPg).toHaveBeenCalledWith({ connectionString: DATABASE_URL });
  });

  it("disconnects when the app shuts down", async () => {
    const prisma = new PrismaService(configWith(DATABASE_URL).config);
    const disconnect = vi.spyOn(prisma, "$disconnect");

    await prisma.onModuleDestroy();

    expect(disconnect).toHaveBeenCalledOnce();
  });
});
