import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getHonoUsers } from "../../integrations/hono/ttp-client";

export const Route = createFileRoute("/demo/tanstack-query")({
  component: TanStackQueryDemo,
});

function TanStackQueryDemo() {
  const {
    data = [],
    error,
    isLoading,
  } = useQuery({
    queryKey: ["hono-users"],
    queryFn: getHonoUsers,
    initialData: [],
  });

  return (
    <div
      className="flex items-center justify-center min-h-screen bg-linear-to-br from-purple-100 to-blue-100 p-4 text-white"
      style={{
        backgroundImage:
          "radial-gradient(50% 50% at 95% 5%, #f4a460 0%, #8b4513 70%, #1a0f0a 100%)",
      }}
    >
      <div className="w-full max-w-2xl p-8 rounded-xl backdrop-blur-md bg-black/50 shadow-xl border-8 border-black/10">
        <p className="mb-2 text-sm uppercase tracking-[0.24em] text-white/70">Hono RPC Demo</p>
        <h1 className="text-2xl mb-3">TanStack Query with data from the Hono server</h1>
        <p className="mb-6 text-sm text-white/80">
          This query calls the standalone `apps/ttp` Hono app through a typed RPC client and renders
          the JSON response from `GET /api/users`.
        </p>
        {isLoading ? (
          <p className="mb-4 rounded-lg border border-white/15 bg-white/10 p-3 text-sm text-white/80">
            Loading users from Hono...
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 rounded-lg border border-red-300/30 bg-red-500/20 p-3 text-sm text-red-100">
            {(error as Error).message}
          </p>
        ) : null}
        <ul className="mb-4 space-y-2">
          {data.map((user) => (
            <li
              key={user.id}
              className="bg-white/10 border border-white/20 rounded-lg p-3 backdrop-blur-sm shadow-md"
            >
              <span className="text-lg text-white">{user.name}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
