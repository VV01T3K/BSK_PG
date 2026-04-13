import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { getServerFnUsers } from "../../functions/users";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";

export const Route = createFileRoute("/demo/tanstack-query-server")({
  component: TanStackQueryServerDemo,
});

function TanStackQueryServerDemo() {
  const { data = [], error, isLoading } = useQuery({
    queryKey: ["server-fn-users"],
    queryFn: () => getServerFnUsers(),
    initialData: [],
  });

  return (
    <main className="p-8">
      <Card>
        <CardHeader>
          <CardTitle>TanStack Query + Server Fn</CardTitle>
          <CardDescription>
            Fetches users via createServerFn RPC boundary.
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
