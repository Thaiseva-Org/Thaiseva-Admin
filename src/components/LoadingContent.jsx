import Loading from "./Loading";

const LoadingContent = ({ variant = "default" }) => {
  if (variant === "skeleton") {
    return (
      <div className="space-y-4 p-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-neutral-200 rounded-xl"></div>
          <div className="flex-1 space-y-2">
            <div className="h-8 bg-neutral-200 rounded-lg w-1/3"></div>
            <div className="h-4 bg-neutral-100 rounded w-1/4"></div>
          </div>
        </div>
        
        {/* Search Bar Skeleton */}
        <div className="h-12 bg-neutral-200 rounded-xl w-full"></div>
        
        {/* Table Skeleton */}
        <div className="space-y-3 mt-6">
          {[1, 2, 3, 4, 5].map((item) => (
            <div key={item} className="flex gap-4 p-4 bg-white rounded-xl border border-neutral-100">
              <div className="w-16 h-16 bg-neutral-200 rounded-lg flex-shrink-0"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-neutral-200 rounded w-3/4"></div>
                <div className="h-3 bg-neutral-100 rounded w-1/2"></div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="w-8 h-8 bg-neutral-200 rounded-lg"></div>
                <div className="w-8 h-8 bg-neutral-200 rounded-lg"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 animate-pulse">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="bg-white rounded-2xl border border-neutral-100 p-6 space-y-4">
            <div className="w-full h-48 bg-neutral-200 rounded-xl"></div>
            <div className="space-y-3">
              <div className="h-6 bg-neutral-200 rounded w-3/4"></div>
              <div className="h-4 bg-neutral-100 rounded w-full"></div>
              <div className="h-4 bg-neutral-100 rounded w-5/6"></div>
            </div>
            <div className="flex gap-2">
              <div className="h-10 bg-neutral-200 rounded-lg flex-1"></div>
              <div className="h-10 bg-neutral-200 rounded-lg flex-1"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-[40vh] w-full flex items-center justify-center">
      <div className="text-center space-y-4">
        <Loading />
        <p className="text-neutral-500 font-medium animate-pulse">Loading...</p>
      </div>
    </div>
  );
};

export default LoadingContent;
