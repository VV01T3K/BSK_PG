import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getServerFnUsers } from "../../functions/users";

export const Route = createFileRoute("/demo/tanstack-query-server")({
  component: TanStackQueryServerDemo,
});

function TanStackQueryServerDemo() {
  const {
    data = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ["server-fn-users"],
    queryFn: () => getServerFnUsers(),
    initialData: [],
  });

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-linear-to-br from-emerald-100 to-cyan-100 p-4 text-white"
      style={{
        backgroundImage:
          "radial-gradient(50% 60% at 90% 10%, #5eead4 0%, #0f766e 55%, #042f2e 100%)",
      }}
    >
      <div className="w-full max-w-2xl rounded-xl border-8 border-black/10 bg-black/45 p-8 shadow-xl backdrop-blur-md">
        <p className="mb-2 text-sm uppercase tracking-[0.24em] text-white/70">
          Server Function Demo
        </p>
        <h1 className="mb-3 text-2xl">TanStack Query through createServerFn</h1>
        <p className="mb-4 text-sm text-white/80">
          The browser query calls a public `createServerFn`. That server function is the only code
          allowed to call the private `createServerOnlyFn`, so the server-only helper never runs in
          the client bundle.
        </p>
        <div className="mb-6 rounded-lg border border-white/15 bg-white/10 p-3 text-sm text-white/80">
          Boundary: `useQuery` -&gt; `createServerFn` RPC -&gt; private `createServerOnlyFn`
        </div>
        {isLoading ? (
          <p className="mb-4 rounded-lg border border-white/15 bg-white/10 p-3 text-sm text-white/80">
            Loading users through the server function...
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300/30 bg-red-500/20 p-3 text-sm text-red-100">
            {(error as Error).message}
          </p>
        ) : null}
        <ul className="space-y-2">
          {data.map((user) => (
            <li
              key={user.id}
              className="rounded-lg border border-white/20 bg-white/10 p-3 shadow-md backdrop-blur-sm"
            >
              <span className="text-lg text-white">{user.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
