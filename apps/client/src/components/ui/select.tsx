import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "#/components/utils";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
};

type SelectProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function Select<T extends string>({
  value,
  onValueChange,
  options,
  placeholder = "Select an option",
  disabled,
  className,
}: SelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;

    const handlePointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((previous) => !previous)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 dark:bg-input/30 [&_svg]:size-4 [&_svg]:shrink-0"
      >
        <span className={cn("flex items-center gap-2", !selected && "text-muted-foreground")}>
          {selected?.icon}
          {selected?.label ?? placeholder}
        </span>
        <ChevronDownIcon className="opacity-50" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              onClick={() => {
                onValueChange(option.value);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0"
            >
              {option.icon}
              {option.label}
              {option.value === value && <CheckIcon className="ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
