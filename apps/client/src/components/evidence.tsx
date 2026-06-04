export function Evidence({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1 rounded-md border p-3">
      <span className="text-xs font-medium text-muted-foreground uppercase">{label}</span>
      <span className="font-mono text-xs break-all">{value ?? "not available"}</span>
    </div>
  );
}
