import { HeadContent, Scripts, createRootRouteWithContext } from "@tanstack/react-router";
import { AppSidebar } from "../components/AppSidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "../components/ui/sidebar";

import appCss from "../styles.css?url";

import type { QueryClient } from "@tanstack/react-query";

interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "BSK PG" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-12 items-center border-b px-4">
              <SidebarTrigger />
            </header>
            <div className="flex-1 overflow-auto px-60">{children}</div>
          </SidebarInset>
        </SidebarProvider>
        <Scripts />
      </body>
    </html>
  );
}
