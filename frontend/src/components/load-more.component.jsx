import { useEffect, useRef, useState } from "react";
import Loader from "./loader.component";

/* ─── Infinite Scroll Trigger ─────────────────────────────────
   Supports two interfaces:

   1. Legacy (old pages): { state, fetchDataFun, additionalParam }
      - state = { results: [], totalDocs: N, page: N }
      - fetchDataFun({ page }) triggers next page fetch

   2. TanStack Query: { fetchNextPage, hasNextPage, isFetchingNextPage }
      - fetchNextPage() triggers next page
      - hasNextPage boolean controls visibility
      - isFetchingNextPage boolean controls spinner
   ───────────────────────────────────────────────────────────── */
const InfiniteScrollTrigger = ({
    // TanStack Query interface
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    // Legacy interface
    state,
    fetchDataFun,
    additionalParam,
}) => {
    const sentinelRef = useRef(null);
    const [legacyLoading, setLegacyLoading] = useState(false);

    // Determine which interface is active
    const isTanStackMode = typeof fetchNextPage === 'function';

    // Legacy refs
    const fetchRef = useRef(fetchDataFun);
    const paramRef = useRef(additionalParam);
    const stateRef = useRef(state);

    fetchRef.current = fetchDataFun;
    paramRef.current = additionalParam;
    stateRef.current = state;

    const legacyHasMore = !isTanStackMode && state != null && state.totalDocs > state.results.length;
    const shouldShow = isTanStackMode ? !!hasNextPage : legacyHasMore;
    const isLoading = isTanStackMode ? isFetchingNextPage : legacyLoading;

    // Reset legacy loading when new data arrives
    useEffect(() => {
        if (!isTanStackMode) {
            setLegacyLoading(false);
        }
    }, [state?.results?.length, isTanStackMode]);

    // Single stable observer
    useEffect(() => {
        if (!shouldShow) return;

        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    if (isTanStackMode) {
                        // TanStack Query mode — just call fetchNextPage
                        fetchNextPage();
                    } else {
                        // Legacy mode — manage loading state manually
                        setLegacyLoading((prev) => {
                            if (prev) return true;
                            const s = stateRef.current;
                            if (s && s.totalDocs > s.results.length) {
                                fetchRef.current({ ...paramRef.current, page: s.page + 1 });
                            }
                            return true;
                        });
                    }
                }
            },
            { rootMargin: "300px" }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [shouldShow, isTanStackMode, fetchNextPage]);

    if (!shouldShow) return null;

    return (
        <div ref={sentinelRef} className="infinite-scroll-trigger">
            {isLoading && (
                <div className="infinite-scroll-loader">
                    <Loader />
                </div>
            )}
        </div>
    );
};

/* ─── Default export — supports both interfaces ────────────── */
const LoadMoreDataBtn = (props) => {
    return <InfiniteScrollTrigger {...props} />;
};

export { InfiniteScrollTrigger };
export default LoadMoreDataBtn;