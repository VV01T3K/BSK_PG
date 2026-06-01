import * as React from "react";

import { cn } from "#/components/utils";

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive";

const variants: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline:
    "border bg-background hover:bg-accent hover:text-accent-foreground dark:border-input dark:bg-input/30",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
};

function Button({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"button"> & {
  variant?: ButtonVariant;
}) {
  return (
    <button
      data-slot="button"
      data-variant={variant}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium whitespace-nowrap transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Button };
