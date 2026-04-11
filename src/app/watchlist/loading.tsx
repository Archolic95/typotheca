export default function WatchlistLoading() {
  return (
    <div className="p-4 md:p-6">
      <div className="h-6 w-28 bg-neutral-800 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-neutral-800/30 border border-neutral-800 rounded-lg h-40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
