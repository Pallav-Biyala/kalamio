import { Link } from "react-router-dom";
import usePageTitle from "../common/usePageTitle";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NetworkError from "../components/network-error.component";
import Icon from "../components/Icon";
import { getDay } from "../common/date";
import { useAnalytics } from "../hooks/queries";

// Monochrome accent throughout; the icon shape is what distinguishes each stat.
// `color` is emitted as the inline --card-color on each card and consumed by
// .analytics__card-icon, so a stat can be tinted individually without new CSS.
const STAT_CARDS = [
    { key: "total_posts", label: "Posts", icon: "article", color: "--c-brand-accent" },
    { key: "total_reads", label: "Reads", icon: "visibility", color: "--c-brand-accent" },
    { key: "total_likes", label: "Likes", icon: "favorite", color: "--c-brand-accent" },
    { key: "total_comments", label: "Comments", icon: "chat_bubble", color: "--c-brand-accent" },
    { key: "total_followers", label: "Followers", icon: "group", color: "--c-brand-accent" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split("-");
    return `${MONTH_NAMES[parseInt(month) - 1]} '${year.slice(2)}`;
};

const AnalyticsPage = () => {

    usePageTitle("Analytics");

    const { data, isLoading, isError, refetch } = useAnalytics();

    if (isLoading) return <Loader />;

    // A failed fetch must not fall through to the zero-filled cards below — that
    // reads as "all your stats are gone" rather than "we couldn't load them".
    if (isError) return <NetworkError onRetry={refetch} />;

    const { overview, topPosts, growth } = data || {};
    const maxGrowth = growth?.length ? Math.max(...growth.map(g => g.count)) : 0;

    // Brand-new author: no posts and no audience yet. Explain the blank slate
    // instead of showing a wall of zeros.
    const isEmpty = !overview?.total_posts && !overview?.total_followers && !topPosts?.length;

    if (isEmpty) {
        return (
            <AnimationWrapper>
                <div className="analytics">

                    <h1 className="analytics__title">
                        <Icon name="analytics" className="analytics__title-icon" />
                        Analytics
                    </h1>

                    <div className="text-center w-full py-14 mt-4">
                        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-grey flex items-center justify-center">
                            <Icon name="bar_chart" className="text-2xl text-dark-grey" />
                        </div>
                        <p className="text-dark-grey text-lg font-medium">No stats yet</p>
                        <p className="text-dark-grey/50 text-sm mt-1.5">
                            Publish your first post — reads, likes and followers will show up here.
                        </p>
                        <Link to="/editor" className="btn-brand inline-flex gap-2 items-center py-2 px-5 text-base mt-6">
                            <Icon name="edit_note" className="text-lg" />
                            Write your first post
                        </Link>
                    </div>

                </div>
            </AnimationWrapper>
        );
    }

    return (
        <AnimationWrapper>
            <div className="analytics">

                <h1 className="analytics__title">
                    <Icon name="analytics" className="analytics__title-icon" />
                    Analytics
                </h1>

                {/* Overview Cards */}
                <div className="analytics__overview">
                    {STAT_CARDS.map(({ key, label, icon, color }) => (
                        <div key={key} className="analytics__card" style={{ '--card-color': `rgb(var(${color}))` }}>
                            <Icon name={icon} className="analytics__card-icon" />
                            <div className="analytics__card-value">
                                {(overview?.[key] ?? 0).toLocaleString()}
                            </div>
                            <div className="analytics__card-label">{label}</div>
                        </div>
                    ))}
                </div>

                {/* Top Posts */}
                {topPosts?.length > 0 && (
                    <div className="analytics__section">
                        <h2 className="analytics__section-title">
                            <Icon name="trending_up" className="text-brand" />
                            Top Posts
                        </h2>
                        <div className="analytics__top-posts">
                            {topPosts.map((post, i) => (
                                <Link
                                    key={post.blog_id}
                                    to={`/blog/${post.blog_id}`}
                                    className="analytics__post-row"
                                >
                                    <span className="analytics__post-rank">#{i + 1}</span>
                                    <div className="analytics__post-info">
                                        <h3 className="analytics__post-title">{post.title}</h3>
                                        <div className="analytics__post-meta">
                                            <span><Icon name="visibility" className="text-xs" /> {post.total_reads}</span>
                                            <span><Icon name="favorite" className="text-xs" /> {post.total_likes}</span>
                                            <span><Icon name="chat_bubble" className="text-xs" /> {post.total_comments}</span>
                                            <span>{getDay(post.publishedAt)}</span>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* Follower Growth */}
                {growth?.length > 0 && (
                    <div className="analytics__section">
                        <h2 className="analytics__section-title">
                            <Icon name="group_add" className="text-brand" />
                            Follower Growth
                        </h2>
                        <div className="analytics__growth-chart">
                            {growth.map((g, i) => (
                                <div key={i} className="analytics__growth-bar-wrap">
                                    <div
                                        className="analytics__growth-bar"
                                        style={{ height: `${maxGrowth > 0 ? (g.count / maxGrowth) * 100 : 0}%` }}
                                    />
                                    <span className="analytics__growth-count">{g.count}</span>
                                    <span className="analytics__growth-label">{formatMonth(g.month)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </AnimationWrapper>
    );
};

export default AnalyticsPage;
