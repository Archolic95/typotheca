export default function MonitorLoading() {
  return (
    <div className="p-4 md:p-6">
      <div className="h-6 w-28 bg-neutral-800 rounded mb-4 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-neutral-800/50 rounded-lg p-3 h-16 animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="bg-neutral-800/30 border border-neutral-800 rounded-lg h-40 animate-pulse" />
        ))}
      </div>
    </div>
  );
}
