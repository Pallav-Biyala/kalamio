import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Loader from "../components/loader.component";
import { filterPaginationData } from "../common/filter-pagination-data";
import { UserContext } from "../App";
import { getRelativeTime } from "../common/date";
import toast from "react-hot-toast";
import SaveModal from "../components/save-modal.component";

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

    const [isLiked, setIsLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(total_likes);
    const [showFullDes, setShowFullDes] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

    useEffect(() => {
        if (access_token) {
            api.post("/isliked-by-user", { _id })
                .then(({ data: { result } }) => setIsLiked(Boolean(result)))
                .catch(() => {});
            api.post("/collection/is-saved", { blog_id })
                .then(({ data }) => setIsSaved(data.saved))
                .catch(() => {});
        }
    }, [access_token, _id]);

    const handleLike = () => {
        if (access_token) {
            setIsLiked(prev => !prev);
            setLikesCount(prev => !isLiked ? prev + 1 : prev - 1);
            api.post("/like-blog", { _id, isLikedByUser: isLiked }).catch(() => {});
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
                        <img src={banner} alt="" draggable="false" />
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
                        <span>{formatCount(likesCount)}</span>
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
                    onClose={() => {
                        setShowSaveModal(false);
                        api.post("/collection/is-saved", { blog_id })
                            .then(({ data }) => setIsSaved(data.saved))
                            .catch(() => {});
                    }}
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
    const [blogs, setBlogs] = useState(null);
    const scrollRef = useRef(null);
    const { userAuth: { access_token } } = useContext(UserContext);

    // Show hint only if never seen before (like Instagram)
    const alreadySeen = sessionStorage.getItem(HINT_KEY);
    const [showHint, setShowHint] = useState(!alreadySeen);

    usePageTitle("Reads — Kalamio");

    const fetchBlogs = useCallback(({ page = 1 }) => {
        api.post("/latest-blogs", { page, exclude_type: "text_post" })
            .then(async ({ data }) => {
                let formatedData = await filterPaginationData({
                    state: blogs,
                    data: data.blogs,
                    page,
                    countRoute: "/all-latest-blogs-count",
                    data_to_send: { exclude_type: "text_post" },
                });
                setBlogs(formatedData);
            })
            .catch(() => {});
    }, [blogs]);

    useEffect(() => {
        fetchBlogs({ page: 1 });
    }, []);

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
        if (!container || !blogs) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            if (scrollHeight - scrollTop - clientHeight < clientHeight * 2) {
                if (blogs.page < blogs.totalDocs / 5) {
                    fetchBlogs({ page: blogs.page + 1 });
                }
            }
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        return () => container.removeEventListener("scroll", handleScroll);
    }, [blogs, fetchBlogs]);

    if (blogs === null) {
        return (
            <div className="reel-loader">
                <Loader />
            </div>
        );
    }

    if (!blogs.results?.length) {
        return (
            <div className="reel-loader">
                <Icon name="auto_stories" className="text-5xl text-dark-grey" />
                <p style={{ color: "rgb(var(--c-dark-grey))", marginTop: "12px" }}>No stories to read yet</p>
            </div>
        );
    }

    return (
        <div className="reels-container" ref={scrollRef}>
            {blogs.results.map((blog, i) => (
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
