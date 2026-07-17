import usePageTitle from "../common/usePageTitle";
import { cdnUrl } from "../common/cdn";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Loader from "../components/loader.component";
import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import api from "../common/api";
import { UserContext } from "../App";
import { getRelativeTime } from "../common/date";
import toast from "react-hot-toast";
import SaveModal from "../components/save-modal.component";
import { useLikeStatus, useIsSaved } from "../hooks/queries";
import { useLikeBlog } from "../hooks/mutations";

/* ───────────────────────────────────────────────────
   Single Reel Card — one per screen
   ─────────────────────────────────────────────────── */
const ReelCard = ({ blog }) => {
    const navigate = useNavigate();
    const { userAuth: { access_token } } = useContext(UserContext);

    const {
        _id,
        blog_id,
        title,
        des,
        banner,
        tags,
        publishedAt,
        readTime,
        activity: { total_likes, total_comments },
        author: { personal_info: { fullname, profile_img, username } },
    } = blog;

    // TanStack Query hooks for like & save status
    const { data: isLiked } = useLikeStatus(_id);
    const { data: isSaved } = useIsSaved(blog_id);
    const likeMutation = useLikeBlog(blog_id);

    const [showFullDes, setShowFullDes] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

    // Like count reads straight from `total_likes` (query-cache-backed); useLikeBlog patches that
    // cache optimistically and adopts the server count. No local mirror — see blog-post.component.
    const handleLike = () => {
        if (access_token) {
            likeMutation.mutate({ _id, isLikedByUser: isLiked });
        } else {
            toast.error("Please sign in to like");
        }
    };

    const formatCount = (n) => {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
        if (n >= 1000) return (n / 1000).toFixed(1) + "K";
        return n;
    };

    const displayReadTime = readTime || 1;

    return (
        <div className="reel-card">
            <div className="reel-card__inner">
                {/* Background image layer */}
                {banner && (
                    <div className="reel-card__bg">
                        <img src={cdnUrl(banner)} alt="" draggable="false" />
                    </div>
                )}

                {/* Gradient overlays */}
                <div className="reel-card__gradient-top" />
                <div className="reel-card__gradient-bottom" />

                {/* Top bar — read time pill */}
                <div className="reel-card__top">
                    <div className="reel-card__read-time">
                        <Icon name="schedule" className="reel-card__read-time-icon" />
                        {displayReadTime} min read
                    </div>
                </div>

                {/* Right side action buttons */}
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
                        <Icon name={isSaved ? "bookmark" : "bookmark_border"} />
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                    </button>

                    <button className="reel-card__action-btn" aria-label="Share">
                        <Icon name="share" />
                        <span>Share</span>
                    </button>

                    {/* Read Full — distinctive button at bottom of actions */}
                    <Link to={`/blog/${blog_id}`} className="reel-card__read-btn" aria-label="Read full blog">
                        <Icon name="auto_stories" />
                        <span>Read</span>
                    </Link>
                </div>

                {/* Bottom content overlay */}
                <div className="reel-card__content">
                    {/* Author row */}
                    <Link to={`/user/${username}`} className="reel-card__author">
                        <Avatar src={profile_img} alt={fullname} size={36} />
                        <div className="reel-card__author-info">
                            <span className="reel-card__author-name">{fullname}</span>
                            <span className="reel-card__author-meta">@{username} · {getRelativeTime(publishedAt)}</span>
                        </div>
                    </Link>

                    {/* Title */}
                    <h2 className="reel-card__title">{title}</h2>

                    {/* Description — expandable */}
                    {des && (
                        <div className={`reel-card__des ${showFullDes ? "reel-card__des--expanded" : ""}`}>
                            <p>{des}</p>
                            {des.length > 100 && !showFullDes && (
                                <button className="reel-card__des-toggle" onClick={() => setShowFullDes(true)}>
                                    more
                                </button>
                            )}
                        </div>
                    )}

                    {/* Tags */}
                    {tags && tags.length > 0 && (
                        <div className="reel-card__tags">
                            {tags.slice(0, 4).map((tag, i) => (
                                <span
                                    key={i}
                                    className="reel-card__tag"
                                    onClick={() => navigate(`/search/${tag}`)}
                                >
                                    #{tag}
                                </span>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {showSaveModal && (
                <SaveModal
                    blogId={blog_id}
                    isOpen={showSaveModal}
                    onClose={() => setShowSaveModal(false)}
                />
            )}
        </div>
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
