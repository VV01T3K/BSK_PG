import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

export function getContext() {
  const queryClient = new QueryClient();

  return {
    queryClient,
  };
}

interface TanstackQueryProviderProps {
  children: ReactNode;
  queryClient: QueryClient;
}

export default function TanstackQueryProvider({ children, queryClient }: TanstackQueryProviderProps) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
