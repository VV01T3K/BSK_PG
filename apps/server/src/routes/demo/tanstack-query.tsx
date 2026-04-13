import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getHonoUsers } from "../../integrations/hono/ttp-client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";

export const Route = createFileRoute("/demo/tanstack-query")({
  component: TanStackQueryDemo,
});

function TanStackQueryDemo() {
  const { data = [], error, isLoading } = useQuery({
    queryKey: ["hono-users"],
    queryFn: getHonoUsers,
    initialData: [],
  });

  return (
    <main className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>TanStack Query + Hono RPC</CardTitle>
          <CardDescription>
            Fetches users from the Hono server via typed RPC client.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
          <ul className="space-y-2">
            {data.map((user) => (
              <li key={user.id} className="rounded-md border px-3 py-2 text-sm">
                {user.name}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
