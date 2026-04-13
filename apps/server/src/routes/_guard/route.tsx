import { Outlet, createFileRoute } from "@tanstack/react-router";
import { AppSidebar } from "#/components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "#/components/ui/sidebar";
import { ensureAppStartup } from "#/integrations/tanstack/query/app-startup";

export const Route = createFileRoute("/_guard")({
  ssr: false,
  loader: ({ context }) => ensureAppStartup(context.queryClient),
  pendingComponent: AppStartupPending,
  pendingMs: 0,
  component: AppLayout,
});

function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-4">
          <SidebarTrigger />
        </header>
        <div className="flex-1 overflow-auto px-60">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function AppStartupPending() {
  return (
    <main className="flex min-h-[calc(100vh-3rem)] items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-4 size-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Loading app...</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Waiting for the Hono server startup check to finish.
        </p>
      </div>
    </main>
  );
}
