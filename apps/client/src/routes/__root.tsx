import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useRouter,
} from "@tanstack/react-router";

import appCss from "#/styles.css?url";

import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";

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
  notFoundComponent: NotFound,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <QueryClientProvider client={router.options.context.queryClient}>
          <div className="min-h-screen">
            <header className="border-b px-6 py-3 text-sm font-medium text-muted-foreground">
              BSK PG Security Flow
            </header>
            {children}
          </div>
        </QueryClientProvider>
        <Scripts />
      </body>
    </html>
  );
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.25rem)] w-full max-w-3xl flex-col justify-center gap-4 p-6">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-3xl font-semibold tracking-normal text-foreground">Page not found</h1>
      <p className="text-sm leading-6 text-muted-foreground">
        The requested route is not available.
      </p>
      <div>
        <Link
          to="/"
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium whitespace-nowrap text-primary-foreground transition-all outline-none hover:bg-primary/90 focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
