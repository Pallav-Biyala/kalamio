import { useContext, useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { UserContext } from "../App";
import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { filterPaginationData } from "../common/filter-pagination-data";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import BlogPostCard from "../components/blog-post.component";
import TextPostCard from "../components/text-post-card.component";
import Icon from "../components/Icon";

const SubscriptionsPage = () => {

    usePageTitle("Subscriptions");

    const { userAuth: { access_token } } = useContext(UserContext);
    const navigate = useNavigate();

    const [publications, setPublications] = useState(null);
    const [selectedPub, setSelectedPub] = useState(null); // null = "All"
    const [blogs, setBlogs] = useState(null);
    const pubsScrollRef = useRef(null);

    // Redirect to signin if not logged in
    useEffect(() => {
        if (access_token === null) return; // still loading
        if (!access_token) {
            navigate("/signin");
        }
    }, [access_token]);

    // Fetch subscribed publications
    useEffect(() => {
        if (!access_token) return;
        api.post("/my-subscriptions")
            .then(({ data }) => setPublications(data.publications))
            .catch(() => setPublications([]));
    }, [access_token]);

    // Fetch feed when selectedPub changes
    useEffect(() => {
        if (!access_token) return;
        setBlogs(null);
        fetchFeed({ page: 1 });
    }, [selectedPub, access_token]);

    const fetchFeed = ({ page = 1 }) => {
        const body = { page };
        if (selectedPub) body.publication_id = selectedPub._id;

        api.post("/subscription-feed", body)
            .then(async ({ data }) => {
                const formatted = await filterPaginationData({
                    state: page === 1 ? null : blogs,
                    data: data.blogs,
                    page,
                    countRoute: "/subscription-feed-count",
                    data_to_send: selectedPub ? { publication_id: selectedPub._id } : {}
                });
                setBlogs(formatted);
            })
            .catch(() => setBlogs({ results: [], totalDocs: 0, page: 1 }));
    };

    if (!access_token) return <Loader />;

    return (
        <AnimationWrapper>
            <section className="subscriptions-page">

                {/* ── Publication Avatars Row ──────────────── */}
                <div className="subscriptions-page__pubs-row">
                    {publications === null ? (
                        <div className="py-4 w-full flex justify-center"><Loader /></div>
                    ) : publications.length === 0 ? (
                        <div className="subscriptions-page__empty-pubs">
                            <Icon name="subscriptions" className="text-2xl text-dark-grey" />
                            <span className="text-dark-grey text-sm">No subscriptions yet</span>
                        </div>
                    ) : (
                        <div className="subscriptions-page__pubs-scroll" ref={pubsScrollRef}>
                            {/* "All" chip */}
                            <button
                                className={"subscriptions-page__pub-chip" + (selectedPub === null ? " active" : "")}
                                onClick={() => setSelectedPub(null)}
                            >
                                <div className="subscriptions-page__pub-avatar subscriptions-page__pub-avatar--all">
                                    <Icon name="grid_view" className="text-lg" />
                                </div>
                                <span className="subscriptions-page__pub-name">All</span>
                            </button>

                            {publications.map((pub) => (
                                <button
                                    key={pub._id}
                                    className={"subscriptions-page__pub-chip" + (selectedPub?._id === pub._id ? " active" : "")}
                                    onClick={() => setSelectedPub(pub)}
                                >
                                    <div className="subscriptions-page__pub-avatar">
                                        {pub.banner ? (
                                            <img src={pub.banner} alt="" />
                                        ) : (
                                            <Icon name="import_contacts" className="text-lg text-dark-grey" />
                                        )}
                                    </div>
                                    <span className="subscriptions-page__pub-name">{pub.title}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ── Selected Publication Card ──────────── */}
                {selectedPub && (
                    <div className="subscriptions-page__selected-card">
                        <div className="subscriptions-page__selected-top">
                            <div className="subscriptions-page__selected-avatar">
                                {selectedPub.banner ? (
                                    <img src={selectedPub.banner} alt="" />
                                ) : (
                                    <Icon name="import_contacts" className="text-2xl text-dark-grey" />
                                )}
                            </div>
                            <div className="subscriptions-page__selected-text">
                                <h2 className="subscriptions-page__selected-title">{selectedPub.title}</h2>
                                {selectedPub.description && (
                                    <p className="subscriptions-page__selected-desc">{selectedPub.description}</p>
                                )}
                                <div className="subscriptions-page__selected-stats">
                                    <span><Icon name="article" className="text-sm" /> {selectedPub.total_posts} posts</span>
                                    <span><Icon name="group" className="text-sm" /> {selectedPub.total_subscribers} subscribers</span>
                                </div>
                            </div>
                        </div>
                        <Link to={`/publication/${selectedPub.slug}`} className="subscriptions-page__view-pub-btn">
                            <Icon name="open_in_new" className="text-base" />
                            View Publication
                        </Link>
                    </div>
                )}

                {/* ── Feed ──────────────────────────────────── */}
                <div className="subscriptions-page__feed">
                    {blogs === null ? (
                        <Loader />
                    ) : blogs.results.length ? (
                        <>
                            {blogs.results.map((blog, i) => (
                                <AnimationWrapper
                                    key={blog.blog_id || blog._id}
                                    transition={{ duration: 0.4, delay: i * 0.04 }}
                                >
                                    {blog.type === 'text_post' ? (
                                        <TextPostCard
                                            content={blog}
                                            author={blog.author.personal_info}
                                        />
                                    ) : (
                                        <BlogPostCard
                                            content={blog}
                                            author={blog.author.personal_info}
                                        />
                                    )}
                                </AnimationWrapper>
                            ))}
                            <LoadMoreDataBtn state={blogs} fetchDataFun={fetchFeed} />
                        </>
                    ) : (
                        <div className="subscriptions-page__empty-feed">
                            <Icon name="inbox" className="text-5xl text-dark-grey" />
                            <h3 className="font-bold text-xl mt-4">
                                {selectedPub ? "No posts yet" : "Your subscription feed is empty"}
                            </h3>
                            <p className="text-dark-grey mt-2">
                                {selectedPub
                                    ? `${selectedPub.title} hasn't published anything yet.`
                                    : "Subscribe to publications to see their latest content here."
                                }
                            </p>
                        </div>
                    )}
                </div>

            </section>
        </AnimationWrapper>
    );
};

export default SubscriptionsPage;
