// class-transformer reads property types with Reflect.getMetadata. Nest
// loads this polyfill too, but env.ts must also work on its own (in tests)
import "reflect-metadata";
import { plainToInstance } from "class-transformer";
import { IsEnum, IsInt, IsUrl, Max, Min, validateSync } from "class-validator";

export enum NodeEnv {
  Development = "development",
  Test = "test",
  Production = "production",
}

// The environment the API needs. Values come from process.env and
// backend/.env as strings; class-transformer converts them to these types,
// and properties left out of the env keep their defaults below.
//
// Every property needs an explicit type annotation: the conversion reads it
// from the decorator metadata, and an inferred type is emitted as Object.
export class Env {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  // Used from phase 3 (Prisma), required now so .env.example is complete
  @IsUrl({ protocols: ["postgresql", "postgres"], require_tld: false, require_protocol: true })
  DATABASE_URL!: string;
}

// Passed to ConfigModule.forRoot({ validate }): runs once at startup and
// throws, so the app does not start with a broken environment. Every
// invalid variable is listed, not only the first one.
export function validate(config: Record<string, unknown>): Env {
  // An empty value (`PORT=` in .env) counts as unset, so the default applies
  // instead of "" being converted to 0
  const present = Object.fromEntries(Object.entries(config).filter(([, value]) => value !== ""));
  const env = plainToInstance(Env, present, { enableImplicitConversion: true });
  const errors = validateSync(env);
  if (errors.length > 0) {
    const details = errors
      .map((error) => `  ${error.property}: ${Object.values(error.constraints ?? {}).join("; ")}`)
      .join("\n");
    throw new Error(`Invalid environment:\n${details}`);
  }
  return env;
}
