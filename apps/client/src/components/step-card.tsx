import { CheckCircle2Icon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "#/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "#/components/ui/card";

export type StepCardProps = {
  title: string;
  description: string;
  complete: boolean;
  icon: ReactNode;
  button: {
    label: string;
    icon?: ReactNode;
    variant?: ComponentProps<typeof Button>["variant"];
    onClick: () => void;
    disabled?: boolean;
  };
};

export function StepCard({ title, description, complete, icon, button }: StepCardProps) {
  return (
    <Card className="rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={complete ? "text-emerald-300" : "text-muted-foreground"}>
            {complete ? <CheckCircle2Icon /> : icon}
          </span>
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant={button.variant} onClick={button.onClick} disabled={button.disabled}>
          {button.icon}
          {button.label}
        </Button>
      </CardContent>
    </Card>
  );
}
