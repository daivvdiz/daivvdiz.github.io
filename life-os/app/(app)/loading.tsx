export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-56 animate-pulse rounded-md bg-card" />
      <div className="h-40 animate-pulse rounded-lg bg-card" />
      <div className="h-64 animate-pulse rounded-lg bg-card" />
    </div>
  );
}
