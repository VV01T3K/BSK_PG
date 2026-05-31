export function Evidence({ label, value }: { label: string; value?: string }) {
  return (
    <div className="grid gap-1 rounded-md border p-3">
      <span className="text-xs font-medium uppercase text-muted-foreground">{label}</span>
      <span className="break-all font-mono text-xs">{value ?? "not available"}</span>
    </div>
  );
}
