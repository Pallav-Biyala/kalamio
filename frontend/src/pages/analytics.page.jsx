import { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import api from "../common/api";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import Icon from "../components/Icon";
import { getDay } from "../common/date";

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

    const { userAuth: { access_token } } = useContext(UserContext);
    const [overview, setOverview] = useState(null);
    const [topPosts, setTopPosts] = useState(null);
    const [growth, setGrowth] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!access_token) return;

        Promise.all([
            api.post("/analytics/overview"),
            api.post("/analytics/top-posts"),
            api.post("/analytics/follower-growth"),
        ])
        .then(([overviewRes, postsRes, growthRes]) => {
            setOverview(overviewRes.data);
            setTopPosts(postsRes.data.posts);
            setGrowth(growthRes.data.growth);
            setLoading(false);
        })
        .catch(() => setLoading(false));
    }, [access_token]);

    if (loading) return <Loader />;

    const maxGrowth = growth?.length ? Math.max(...growth.map(g => g.count)) : 0;

    return (
        <AnimationWrapper>
            <div className="analytics">

                <h1 className="max-md:hidden">Analytics</h1>

                {/* Overview Cards */}
                <div className="analytics__cards">
                    {STAT_CARDS.map(({ key, label, icon, color }) => (
                        <div key={key} className="analytics__card">
                            <div className="analytics__card-icon" style={{ background: `rgb(var(${color}) / 0.12)`, color: `rgb(var(${color}))` }}>
                                <Icon name={icon} className="text-[22px]" filled />
                            </div>
                            <div className="analytics__card-data">
                                <span className="analytics__card-value">
                                    {(overview?.[key] ?? 0).toLocaleString()}
                                </span>
                                <span className="analytics__card-label">{label}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Follower Growth */}
                {growth && growth.length > 0 && (
                    <div className="analytics__section">
                        <h2 className="analytics__section-title">Follower Growth (Last 6 Months)</h2>
                        <div className="analytics__growth">
                            {growth.map(({ month, count }) => (
                                <div key={month} className="analytics__growth-bar-wrapper">
                                    <span className="analytics__growth-count">{count}</span>
                                    <div
                                        className="analytics__growth-bar"
                                        style={{ height: `${maxGrowth > 0 ? Math.max((count / maxGrowth) * 100, 8) : 8}%` }}
                                    />
                                    <span className="analytics__growth-label">{formatMonth(month)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Top Posts */}
                <div className="analytics__section">
                    <h2 className="analytics__section-title">Top Performing Posts</h2>
                    {topPosts && topPosts.length > 0 ? (
                        <div className="analytics__table-wrap">
                            <table className="analytics__table">
                                <thead>
                                    <tr>
                                        <th className="text-left">Post</th>
                                        <th>Published</th>
                                        <th>Reads</th>
                                        <th>Likes</th>
                                        <th>Comments</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topPosts.map((post) => {
                                        const displayTitle = post.type === "text_post"
                                            ? (post.text_content?.substring(0, 60) + (post.text_content?.length > 60 ? "..." : "")) || "Text Post"
                                            : post.title;
                                        return (
                                            <tr key={post.blog_id}>
                                                <td>
                                                    <Link to={`/blog/${post.blog_id}`} className="analytics__post-link">
                                                        {post.type === "text_post" && (
                                                            <span className="analytics__post-badge">Text</span>
                                                        )}
                                                        {displayTitle}
                                                    </Link>
                                                </td>
                                                <td className="text-center text-dark-grey text-sm whitespace-nowrap">
                                                    {getDay(post.publishedAt)}
                                                </td>
                                                <td className="text-center font-medium">{post.activity?.total_reads?.toLocaleString() ?? 0}</td>
                                                <td className="text-center font-medium">{post.activity?.total_likes?.toLocaleString() ?? 0}</td>
                                                <td className="text-center font-medium">{post.activity?.total_comments?.toLocaleString() ?? 0}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-dark-grey text-sm">No published posts yet. Start writing to see analytics!</p>
                    )}
                </div>
            </div>
        </AnimationWrapper>
    );
};

export default AnalyticsPage;
