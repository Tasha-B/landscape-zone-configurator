import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./plans";

// A 4xx answer will not change on a retry (an unknown plan, a bad id);
// a network error or a 5xx gets one more try before the error state shows
export function shouldRetry(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 1;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry } } });
}
