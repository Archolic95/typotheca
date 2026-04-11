export default function DatabaseLoading() {
  return (
    <div className="p-4 md:p-6">
      <div className="h-6 w-24 bg-neutral-800 rounded mb-4 animate-pulse" />
      <div className="h-10 bg-neutral-800 rounded-lg mb-3 animate-pulse" />
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        <div className="h-9 bg-neutral-900/50 border-b border-neutral-800" />
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="h-9 border-b border-neutral-800/50 animate-pulse bg-neutral-800/20" />
        ))}
      </div>
    </div>
  );
}
