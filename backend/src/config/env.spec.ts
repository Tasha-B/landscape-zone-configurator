import { describe, expect, it } from "vitest";
import { NodeEnv, validate } from "./env.js";

const DATABASE_URL = "postgresql://lzc:lzc@localhost:5432/lzc";

describe("validate", () => {
  it("accepts a complete env and converts the strings", () => {
    const env = validate({ NODE_ENV: "production", PORT: "8080", DATABASE_URL });
    expect(env.NODE_ENV).toBe(NodeEnv.Production);
    expect(env.PORT).toBe(8080);
    expect(env.DATABASE_URL).toBe(DATABASE_URL);
  });

  it("applies defaults for NODE_ENV and PORT", () => {
    const env = validate({ DATABASE_URL });
    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(3000);
  });

  it("treats empty values as unset", () => {
    const env = validate({ NODE_ENV: "", PORT: "", DATABASE_URL });
    expect(env.NODE_ENV).toBe(NodeEnv.Development);
    expect(env.PORT).toBe(3000);
  });

  it("ignores unrelated variables", () => {
    expect(() => validate({ DATABASE_URL, PATH: "/usr/bin", HOME: "/home/me" })).not.toThrow();
  });

  it("accepts the postgres:// scheme and a URL without a port", () => {
    expect(() => validate({ DATABASE_URL: "postgres://user:secret@db/app" })).not.toThrow();
  });

  it.each([
    ["missing", {}],
    ["empty", { DATABASE_URL: "" }],
    ["not a URL", { DATABASE_URL: "localhost:5432" }],
    ["another database", { DATABASE_URL: "mysql://root@localhost:3306/app" }],
  ])("rejects a DATABASE_URL that is %s", (_, config) => {
    expect(() => validate(config)).toThrow(/DATABASE_URL/);
  });

  it.each([
    ["not a number", "abc"],
    ["not an integer", "3000.5"],
    ["zero", "0"],
    ["above 65535", "70000"],
  ])("rejects a PORT that is %s", (_, PORT) => {
    expect(() => validate({ PORT, DATABASE_URL })).toThrow(/PORT/);
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => validate({ NODE_ENV: "staging", DATABASE_URL })).toThrow(/NODE_ENV/);
  });

  it("lists every invalid variable at once", () => {
    let message = "";
    try {
      validate({ PORT: "abc", NODE_ENV: "staging" });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("NODE_ENV");
    expect(message).toContain("PORT");
    expect(message).toContain("DATABASE_URL");
  });
});
