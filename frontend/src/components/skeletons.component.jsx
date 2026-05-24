/**
 * Skeleton loading placeholders that match real content shapes.
 * Uses the `.skeleton` shimmer class from index.css.
 */

/** Blog feed card skeleton — matches FeedCard layout */
export const FeedCardSkeleton = () => (
    <div className="feed-card" aria-hidden="true">
        {/* Author header */}
        <div className="flex items-center gap-3 mb-3">
            <div className="skeleton w-10 h-10 rounded-full flex-none" />
            <div className="flex-1">
                <div className="skeleton h-3.5 w-28 mb-1.5 rounded" />
                <div className="skeleton h-3 w-20 rounded" />
            </div>
        </div>
        {/* Content area */}
        <div className="flex gap-4 items-start">
            <div className="flex-1">
                <div className="skeleton h-5 w-full mb-2 rounded" />
                <div className="skeleton h-5 w-3/4 mb-3 rounded" />
                <div className="skeleton h-3.5 w-full mb-1.5 rounded" />
                <div className="skeleton h-3.5 w-2/3 mb-4 rounded" />
                {/* Tags + meta */}
                <div className="flex items-center gap-3">
                    <div className="skeleton h-7 w-16 rounded-full" />
                    <div className="skeleton h-7 w-20 rounded-full" />
                    <div className="skeleton h-3 w-12 rounded ml-auto" />
                </div>
            </div>
            {/* Banner placeholder */}
            <div className="skeleton w-28 h-28 rounded-radius-md flex-none hidden sm:block" />
        </div>
    </div>
);

/** List of feed card skeletons */
export const FeedListSkeleton = ({ count = 5 }) => (
    <div>
        {Array.from({ length: count }, (_, i) => (
            <FeedCardSkeleton key={i} />
        ))}
    </div>
);

/** Blog page skeleton — matches blog reading layout */
export const BlogPageSkeleton = () => (
    <div className="max-w-[800px] mx-auto py-10 px-5" aria-hidden="true">
        {/* Title */}
        <div className="skeleton h-10 w-full mb-3 rounded" />
        <div className="skeleton h-10 w-3/4 mb-6 rounded" />
        {/* Author */}
        <div className="flex items-center gap-3 mb-8">
            <div className="skeleton w-12 h-12 rounded-full flex-none" />
            <div>
                <div className="skeleton h-4 w-32 mb-1.5 rounded" />
                <div className="skeleton h-3 w-24 rounded" />
            </div>
        </div>
        {/* Banner */}
        <div className="skeleton w-full aspect-video rounded-radius-lg mb-8" />
        {/* Content lines */}
        {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-4 mb-4 rounded" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
    </div>
);

/** Profile page skeleton */
export const ProfileSkeleton = () => (
    <div className="max-w-[700px] mx-auto py-10 px-5" aria-hidden="true">
        <div className="flex items-center gap-6 mb-8">
            <div className="skeleton w-24 h-24 rounded-full flex-none" />
            <div className="flex-1">
                <div className="skeleton h-6 w-40 mb-2 rounded" />
                <div className="skeleton h-4 w-24 mb-3 rounded" />
                <div className="skeleton h-3.5 w-full max-w-[300px] rounded" />
            </div>
        </div>
        {/* Stats row */}
        <div className="flex gap-8 mb-8">
            {[1, 2, 3].map(i => (
                <div key={i}>
                    <div className="skeleton h-6 w-8 mb-1 rounded" />
                    <div className="skeleton h-3 w-14 rounded" />
                </div>
            ))}
        </div>
        {/* Blog list skeletons */}
        <FeedListSkeleton count={3} />
    </div>
);

/** Notification list skeleton */
export const NotificationSkeleton = ({ count = 6 }) => (
    <div className="py-4" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
            <div key={i} className="flex items-start gap-3 py-4 px-4 border-b border-border">
                <div className="skeleton w-10 h-10 rounded-full flex-none" />
                <div className="flex-1">
                    <div className="skeleton h-3.5 w-3/4 mb-2 rounded" />
                    <div className="skeleton h-3 w-1/2 rounded" />
                </div>
            </div>
        ))}
    </div>
);
