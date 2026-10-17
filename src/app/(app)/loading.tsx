export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded-lg bg-surface-2" />
      <div className="h-4 w-80 rounded bg-surface-2" />
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-xl bg-surface-2" />
        <div className="h-28 rounded-xl bg-surface-2" />
        <div className="h-28 rounded-xl bg-surface-2" />
      </div>
    </div>
  );
}
