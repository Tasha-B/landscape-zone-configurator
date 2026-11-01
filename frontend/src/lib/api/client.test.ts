import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, request } from "./client";

describe("request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stub = (response: Response | Error) =>
    vi.stubGlobal("fetch", response instanceof Error ? vi.fn().mockRejectedValue(response) : vi.fn().mockResolvedValue(response));

  it("sends JSON and reads the JSON answer", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: "p1" }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await request("POST", "/plans", { body: { name: "A" } })).toEqual({ id: "p1" });
    expect(fetchMock).toHaveBeenCalledWith("/api/plans", {
      method: "POST",
      signal: undefined,
      headers: { "Content-Type": "application/json" },
      body: '{"name":"A"}',
    });
  });

  it("returns nothing for 204 No Content", async () => {
    stub(new Response(null, { status: 204 }));
    expect(await request("DELETE", "/zones/z1")).toBeUndefined();
  });

  it("throws an ApiError with the API's message, joining a list of them", async () => {
    stub(Response.json({ statusCode: 400, message: ["name should not be empty", "viewBox must be …"] }, { status: 400 }));
    const error = await request("POST", "/plans", { body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, message: "name should not be empty; viewBox must be …" });

    stub(Response.json({ statusCode: 409, message: "Zone z1 has been changed since this version; reload it" }, { status: 409 }));
    await expect(request("PATCH", "/zones/z1", { body: {} })).rejects.toMatchObject({
      status: 409,
      message: "Zone z1 has been changed since this version; reload it",
    });
  });

  it("falls back to the status when the error answer is not JSON", async () => {
    stub(new Response("Bad Gateway", { status: 502 }));
    await expect(request("GET", "/plans")).rejects.toMatchObject({ status: 502, message: "GET /api/plans answered 502" });
  });

  it("lets a network error through as it is", async () => {
    stub(new TypeError("Failed to fetch"));
    const error = await request("GET", "/plans").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TypeError);
    expect(error).not.toBeInstanceOf(ApiError);
  });
});
