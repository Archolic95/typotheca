export default function GalleryLoading() {
  return (
    <div className="p-4 md:p-6">
      <div className="h-6 w-24 bg-neutral-800 rounded mb-4 animate-pulse" />
      <div className="h-10 bg-neutral-800 rounded-lg mb-4 animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="rounded-lg bg-neutral-800/50 overflow-hidden animate-pulse">
            <div className="aspect-[4/5] bg-neutral-800" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-16 bg-neutral-700 rounded" />
              <div className="h-4 w-full bg-neutral-700 rounded" />
              <div className="h-3 w-12 bg-neutral-700 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
