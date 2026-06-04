import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { AnyRouter, RouterClient } from "@orpc/server";

export function rpcUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/rpc`;
}

export function createRpcClient<TRouter extends AnyRouter>(baseUrl: string): RouterClient<TRouter> {
  const link = new RPCLink({
    url: rpcUrl(baseUrl),
    fetch: (request, init) => globalThis.fetch(request, init),
  });
  return createORPCClient<RouterClient<TRouter>>(link);
}
