import { Link, createFileRoute } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/_guard/")({
  component: App,
});

function App() {
  return (
    <main className="flex flex-col gap-4 p-8">
      <h1 className="text-2xl font-bold">Demos</h1>
      <div className="flex gap-3">
        <Button asChild>
          <Link to="/tanstack-query">Query + Hono RPC</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link to="/tanstack-query-server">Query + Server Fn</Link>
        </Button>
      </div>
    </main>
  );
}
