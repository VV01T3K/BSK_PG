import { queryOptions, type QueryClient } from "@tanstack/react-query";
import { getAppStartupStatus } from "#/api/ttp-client";

export function appStartupQueryOptions() {
  return queryOptions({
    queryKey: ["app-startup"],
    queryFn: getAppStartupStatus,
    staleTime: Infinity,
  });
}

export async function ensureAppStartup(queryClient: QueryClient): Promise<void> {
  const isReady = await queryClient.ensureQueryData(appStartupQueryOptions());

  if (isReady !== true) {
    throw new Error("Startup request did not return true.");
  }
}
