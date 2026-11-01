import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client.js";

// Optimistic concurrency. `update` writes with the version the client sent in
// its where clause, so the check and the write are one statement: of two
// requests on the same version, one matches and the other matches nothing.
// Prisma reports "nothing matched" as P2025; then the row is either gone (404)
// or has a newer version (409).
export async function versionedUpdate<T>(
  what: string,
  update: () => Promise<T>,
  exists: () => Promise<boolean>,
): Promise<T> {
  try {
    return await update();
  } catch (error) {
    if (!isRecordNotFound(error)) throw error;
    if (await exists()) throw new ConflictException(`${what} has been changed since this version; reload it`);
    throw new NotFoundException(`${what} not found`);
  }
}

export function isRecordNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}
