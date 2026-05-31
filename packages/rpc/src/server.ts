import type { AnyRouter } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin } from "@orpc/server/plugins";

export function createRpcFetch(router: AnyRouter, banner: string) {
  const handler = new RPCHandler(router, {
    plugins: [
      new CORSPlugin({
        origin: "*",
        allowMethods: ["GET", "POST", "OPTIONS"],
        allowHeaders: ["Content-Type"],
      }),
    ],
  });

  return async function fetch(request: Request): Promise<Response> {
    if (new URL(request.url).pathname === "/") {
      return new Response(banner);
    }

    const { matched, response } = await handler.handle(request, {
      prefix: "/rpc",
      context: {},
    });

    if (matched) {
      return response;
    }

    return new Response("Not found", { status: 404 });
  };
}
