import { useEffect, useRef, useState } from "react";
import Loader from "./loader.component";

/* ─── Infinite Scroll Trigger ─────────────────────────────────
   Automatically loads more data when the sentinel enters viewport.
   Shows a small spinner while loading. No button needed.
   ───────────────────────────────────────────────────────────── */
const InfiniteScrollTrigger = ({ state, fetchDataFun, additionalParam }) => {
    const sentinelRef = useRef(null);
    const [loading, setLoading] = useState(false);
    const fetchRef = useRef(fetchDataFun);
    const paramRef = useRef(additionalParam);
    const stateRef = useRef(state);

    // Keep refs updated without triggering observer re-creation
    fetchRef.current = fetchDataFun;
    paramRef.current = additionalParam;
    stateRef.current = state;

    const hasMore = state != null && state.totalDocs > state.results.length;

    // Reset loading when new data arrives
    useEffect(() => {
        setLoading(false);
    }, [state?.results?.length]);

    // Single stable observer — only recreated when hasMore changes
    useEffect(() => {
        if (!hasMore) return;

        const sentinel = sentinelRef.current;
        if (!sentinel) return;

        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setLoading((prev) => {
                        if (prev) return true; // already loading, skip
                        const s = stateRef.current;
                        if (s && s.totalDocs > s.results.length) {
                            fetchRef.current({ ...paramRef.current, page: s.page + 1 });
                        }
                        return true;
                    });
                }
            },
            { rootMargin: "300px" }
        );

        observer.observe(sentinel);
        return () => observer.disconnect();
    }, [hasMore]);

    if (!hasMore) return null;

    return (
        <div ref={sentinelRef} className="infinite-scroll-trigger">
            {loading && (
                <div className="infinite-scroll-loader">
                    <Loader />
                </div>
            )}
        </div>
    );
};

/* ─── Legacy export (backward compat for all pages) ────────── */
const LoadMoreDataBtn = ({ state, fetchDataFun, additionalParam }) => {
    return (
        <InfiniteScrollTrigger
            state={state}
            fetchDataFun={fetchDataFun}
            additionalParam={additionalParam}
        />
    );
};

export { InfiniteScrollTrigger };
export default LoadMoreDataBtn;