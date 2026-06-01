import * as React from "react";

import { cn } from "#/components/utils";

type AlertVariant = "default" | "destructive";

const variants: Record<AlertVariant, string> = {
  default: "bg-card text-card-foreground",
  destructive: "border-destructive/50 bg-destructive/10 text-destructive [&>svg]:text-current",
};

function Alert({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & { variant?: AlertVariant }) {
  return (
    <div
      data-slot="alert"
      data-variant={variant}
      role="alert"
      className={cn(
        "relative grid w-full grid-cols-[auto_1fr] items-start gap-x-2 gap-y-1 rounded-lg border p-3 text-sm [&>svg]:mt-0.5 [&>svg]:size-4 [&>svg]:shrink-0",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="alert-title" className={cn("font-medium leading-none", className)} {...props} />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm [&_p]:leading-relaxed", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
