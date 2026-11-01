// class-transformer's @Type reads decorator metadata; the DTO unit tests
// load the DTOs without Nest, which loads this polyfill otherwise
import "reflect-metadata";
import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { plainToInstance } from "class-transformer";
import { IsNumber, ValidateIf, validate, type ValidationError, type ValidatorOptions } from "class-validator";

// How request bodies are checked: an unknown field is an error, not silently
// dropped. Shared by the app and the DTO unit tests.
export const VALIDATION_OPTIONS = {
  whitelist: true,
  forbidNonWhitelisted: true,
} as const satisfies ValidatorOptions;

// transform: the handlers receive DTO instances, so nested shapes are
// instances of their class too
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({ ...VALIDATION_OPTIONS, transform: true });
}

// A number that JSON can carry: no NaN, no Infinity
export const FINITE = { allowNaN: false, allowInfinity: false } as const;
export const IsFiniteNumber = () => IsNumber(FINITE);

// May be left out, but not sent as null. IsOptional() accepts both, which
// would let null reach columns that cannot hold it.
export const IsOmittable = () => ValidateIf((_, value) => value !== undefined);

// A PATCH changes something: a body with nothing but `version`, or with only
// empty objects besides it (`content: {}`), would only raise the version
export function assertChanges(dto: { version: number }): void {
  const changed = Object.entries(dto).some(([key, value]) => key !== "version" && !isEmpty(value));
  if (!changed) throw new BadRequestException("Nothing to update: send at least one field besides version");
}

function isEmpty(value: unknown): boolean {
  if (value === undefined) return true;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((item) => item === undefined);
}

// The paths of the invalid properties ("shape.points"), for the DTO unit
// tests: what the ValidationPipe would reject the body for
export async function invalidPaths(cls: new () => object, body: unknown): Promise<string[]> {
  const errors = await validate(plainToInstance(cls, body) as object, VALIDATION_OPTIONS);
  return errors.flatMap((error) => paths(error, ""));
}

function paths(error: ValidationError, prefix: string): string[] {
  const path = prefix + error.property;
  const own = error.constraints ? [path] : [];
  return [...own, ...(error.children ?? []).flatMap((child) => paths(child, `${path}.`))];
}
