export default function FeedLoading() {
  return (
    <div className="p-4 md:p-6 max-w-[800px]">
      <div className="h-6 w-28 bg-neutral-800 rounded mb-4 animate-pulse" />
      <div className="border border-neutral-800 rounded-lg overflow-hidden">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex gap-4 p-4 border-b border-neutral-800/50 animate-pulse">
            <div className="w-3 h-3 rounded-full bg-neutral-700 shrink-0 mt-1" />
            <div className="w-16 h-16 rounded bg-neutral-800 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-16 bg-neutral-700 rounded" />
              <div className="h-4 w-48 bg-neutral-700 rounded" />
              <div className="h-3 w-24 bg-neutral-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
