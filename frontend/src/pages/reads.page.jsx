import usePageTitle from "../common/usePageTitle";
import Icon from "../components/Icon";
import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import Loader from "../components/loader.component";
import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import api from "../common/api";
import { UserContext } from "../App";
import toast from "react-hot-toast";
import SaveModal from "../components/save-modal.component";
import ReelCardVisual from "../components/reel/ReelCardVisual";
import { useLikeStatus, useIsSaved } from "../hooks/queries";
import { useLikeBlog } from "../hooks/mutations";

/* ───────────────────────────────────────────────────
   Single Reel Card — one per screen
   ─────────────────────────────────────────────────── */
const ReelCard = ({ blog }) => {
    const { userAuth: { access_token } } = useContext(UserContext);

    const {
        _id,
        blog_id,
        title,
        activity: { total_likes, total_comments },
    } = blog;

    // TanStack Query hooks for like & save status
    const { data: isLiked } = useLikeStatus(_id);
    const { data: isSaved } = useIsSaved(blog_id);
    const likeMutation = useLikeBlog(blog_id);

    const [showSaveModal, setShowSaveModal] = useState(false);

    // Like count reads straight from `total_likes` (query-cache-backed); useLikeBlog patches that
    // cache optimistically and adopts the server count. No local mirror — see blog-post.component.
    const handleLike = () => {
        if (access_token) {
            // toggle() reads the freshest like-status from the cache (not the stale `isLiked`
            // closure) and never drops a rapid tap — keeps count/icon in sync under latency.
            likeMutation.toggle(_id);
        } else {
            toast.error("Please sign in to like");
        }
    };

    const handleShare = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Same URL shape and toast copy as the feed card / PostMenu so sharing is consistent app-wide.
        const url = `${window.location.origin}/blog/${blog_id}`;
        if (navigator.share) {
            try {
                await navigator.share({ title, url });
                return;
            } catch (err) {
                // Dismissing the native share sheet rejects with AbortError — that's not a failure,
                // so stay silent rather than falling through to the clipboard path.
                if (err?.name === "AbortError") return;
            }
        }
        navigator.clipboard.writeText(url)
            .then(() => toast.success("Link copied"))
            .catch(() => toast.error("Failed to copy"));
    };

    const formatCount = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
        if (n >= 1000) return (n / 1000).toFixed(1) + "K";
        return n;
    };

    return (
        <>
            {/* The reel visual (background, scrims, author, title, des, tags) is shared with the publish
                preview via ReelCardVisual; the feed keeps its own wired action rail as its children. */}
            <ReelCardVisual blog={blog}>
                <div className="reel-card__actions">
                    <button
                        className={`reel-card__action-btn ${isLiked ? "reel-card__action-btn--liked" : ""}`}
                        onClick={handleLike}
                        aria-label="Like"
                    >
                        <Icon name={isLiked ? "favorite" : "favorite_border"} filled={isLiked} />
                        <span>{formatCount(total_likes)}</span>
                    </button>

                    <Link to={`/blog/${blog_id}`} className="reel-card__action-btn" aria-label="Comments">
                        <Icon name="chat_bubble_outline" />
                        <span>{formatCount(total_comments)}</span>
                    </Link>

                    <button
                        className={`reel-card__action-btn${isSaved ? ' reel-card__action-btn--saved' : ''}`}
                        aria-label="Save"
                        onClick={() => {
                            if (!access_token) return toast.error("Please login to save");
                            setShowSaveModal(true);
                        }}
                    >
                        {/* `filled` is what turns the bookmark glyph solid (Icon.jsx FILL_WHEN_ACTIVE) —
                            without it saved/unsaved rendered the identical outline icon. */}
                        <Icon name={isSaved ? "bookmark" : "bookmark_border"} filled={!!isSaved} />
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>

                    <button
                        type="button"
                        className="reel-card__action-btn"
                        aria-label="Share this story"
                        onClick={handleShare}
                    >
                        <Icon name="share" />
                        <span>Share</span>
                    </button>

                    {/* Read Full — distinctive button at bottom of actions */}
                    <Link to={`/blog/${blog_id}`} className="reel-card__read-btn" aria-label="Read full blog">
                        <Icon name="auto_stories" />
                        <span>Read</span>
                    </Link>
                </div>
            </ReelCardVisual>

            {showSaveModal && (
                <SaveModal
                    blogId={blog_id}
                    isOpen={showSaveModal}
                    onClose={() => setShowSaveModal(false)}
                />
            )}
        </>
    );
};


/* ───────────────────────────────────────────────────
   Reads Page — Reels Container
   ─────────────────────────────────────────────────── */
const HINT_KEY = "kalamio_reels_hint_seen";

const ReadsPage = () => {
    const scrollRef = useRef(null);

    // Show hint only if never seen before (like Instagram)
    const alreadySeen = sessionStorage.getItem(HINT_KEY);
    const [showHint, setShowHint] = useState(!alreadySeen);

    usePageTitle("Reads — Kalamio");

    // Infinite query for reels feed (articles only)
    const reelsQuery = useInfiniteQuery({
        queryKey: [...queryKeys.blogs.latest(), 'reels'],
        queryFn: async ({ pageParam = 1 }) => {
            const [blogsRes, countRes] = await Promise.all([
                api.post("/latest-blogs", { page: pageParam, exclude_type: "text_post" }),
                pageParam === 1
                    ? api.post("/all-latest-blogs-count", { exclude_type: "text_post" })
                    : Promise.resolve(null),
            ]);
            return {
                blogs: blogsRes.data.blogs,
                totalDocs: countRes?.data?.totalDocs ?? undefined,
                page: pageParam,
            };
        },
        getNextPageParam: (lastPage, allPages) => {
            const totalLoaded = allPages.reduce((sum, p) => sum + p.blogs.length, 0);
            const totalDocs = allPages[0]?.totalDocs ?? 0;
            if (totalLoaded < totalDocs) return lastPage.page + 1;
            return undefined;
        },
        select: (data) => data.pages.flatMap(p => p.blogs),
    });

    const blogs = reelsQuery.data || [];

    // Swipe hint — dismiss on scroll OR auto-hide after 3s, then never show again
    useEffect(() => {
        if (!showHint) return;

        // Auto-dismiss after 3 seconds
        const timer = setTimeout(() => {
            setShowHint(false);
            sessionStorage.setItem(HINT_KEY, "1");
        }, 3000);

        // Also dismiss on first scroll
        const container = scrollRef.current;
        const handleScroll = () => {
            if (container && container.scrollTop > 20) {
                setShowHint(false);
                sessionStorage.setItem(HINT_KEY, "1");
            }
        };

        if (container) {
            container.addEventListener("scroll", handleScroll, { passive: true });
        }

        return () => {
            clearTimeout(timer);
            if (container) container.removeEventListener("scroll", handleScroll);
        };
    }, [showHint]);

    // Infinite scroll — load more when near end
    useEffect(() => {
        const container = scrollRef.current;
        if (!container || !blogs.length) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollHeight - scrollTop - clientHeight < clientHeight * 2) {
                if (reelsQuery.hasNextPage && !reelsQuery.isFetchingNextPage) {
                    reelsQuery.fetchNextPage();
                }
            }
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, [blogs.length, reelsQuery.hasNextPage, reelsQuery.isFetchingNextPage]);

    if (reelsQuery.isLoading) {
        return (
            <div className="reel-loader">
                <Loader />
            </div>
        );
    }

    if (!blogs.length) {
        return (
            <div className="reel-loader">
                <Icon name="auto_stories" className="text-5xl text-dark-grey" />
                <p style={{ color: "rgb(var(--c-dark-grey))", marginTop: "12px" }}>No stories to read yet</p>
            </div>
        );
    }

    return (
        <div className="reels-container" ref={scrollRef}>
            {blogs.map((blog, i) => (
                <ReelCard key={blog.blog_id} blog={blog} />
            ))}

            {/* Swipe hint — shown only on first visit, fades out */}
            {showHint && (
                <div className="reel-swipe-hint">
                    <div className="reel-swipe-hint__inner">
                        <Icon name="swipe_up" className="reel-swipe-hint__icon" />
                        <span>Swipe up</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReadsPage;
