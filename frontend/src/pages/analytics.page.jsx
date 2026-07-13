import { Link } from "react-router-dom";
import usePageTitle from "../common/usePageTitle";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import Icon from "../components/Icon";
import { getDay } from "../common/date";
import { useAnalytics } from "../hooks/queries";

const STAT_CARDS = [
    { key: "total_posts", label: "Posts", icon: "article", color: "--c-purple" },
    { key: "total_reads", label: "Reads", icon: "visibility", color: "--c-blue" },
    { key: "total_likes", label: "Likes", icon: "favorite", color: "--c-red" },
    { key: "total_comments", label: "Comments", icon: "chat_bubble", color: "--c-green" },
    { key: "total_followers", label: "Followers", icon: "group", color: "--c-orange" },
];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatMonth = (monthStr) => {
    const [year, month] = monthStr.split("-");
    return `${MONTH_NAMES[parseInt(month) - 1]} '${year.slice(2)}`;
};

const AnalyticsPage = () => {

    usePageTitle("Analytics");

    const { data, isLoading } = useAnalytics();

    if (isLoading) return <Loader />;

    const { overview, topPosts, growth } = data || {};
    const maxGrowth = growth?.length ? Math.max(...growth.map(g => g.count)) : 0;

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
