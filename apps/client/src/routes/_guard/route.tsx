import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_guard")({
  ssr: false,
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b px-6 py-3 text-sm font-medium text-muted-foreground">
        BSK PG Security Demo
      </header>
      <Outlet />
    </div>
  );
}
