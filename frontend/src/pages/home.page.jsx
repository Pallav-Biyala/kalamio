import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import Icon from "../components/Icon";
import AnimationWrapper from "../common/page-animation";
import { useContext, useEffect, useState, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import Loader from "../components/loader.component";
import BlogPostCard from "../components/blog-post.component";
import TextPostCard from "../components/text-post-card.component";
import TextPostComposer from "../components/text-post-composer.component";
import MinimalBlogPost from "../components/nobanner-blog-post.component";
import NoDataMessage from "../components/nodata.component";
import { filterPaginationData } from "../common/filter-pagination-data";
import LoadMoreDataBtn from "../components/load-more.component";
import WhoToFollow from "../components/who-to-follow.component";
import RightSidebar from "../components/right-sidebar.component";
import Avatar from "../components/Avatar";
import { UserContext } from "../App";
import NetworkError from "../components/network-error.component";

// ── Module-level cache — survives navigation ──────────────────
const feedCache = {
  blogs: null,
  trendingBlogs: null,
  followingBlogs: null,
  pageState: "home",
  scrollY: 0,
};

const HomePage = () => {
  let [blogs, setBlogs] = useState(feedCache.blogs);
  let [trendingBlogs, setTrendingBlogs] = useState(feedCache.trendingBlogs);
  let [pageState, setPageState] = useState(feedCache.pageState);
  let [likedBlogs, setLikedBlogs] = useState([]);
  let [trendingFilter, setTrendingFilter] = useState("all");
  let [followingBlogs, setFollowingBlogs] = useState(feedCache.followingBlogs);
  let [showComposer, setShowComposer] = useState(false);
  let [editingTextPostId, setEditingTextPostId] = useState(null);
  let [searchQuery, setSearchQuery] = useState("");
  let [feedError, setFeedError] = useState(false);
  let [followingError, setFollowingError] = useState(false);
  let [trendingError, setTrendingError] = useState(false);
  const navigate = useNavigate();

  let { userAuth: { access_token, profile_img } } = useContext(UserContext);

  usePageTitle(pageState === "home" ? "Kalamio" : `#${pageState}`);

  let categories = [
    "For You",
    "Following",
    "Trending",
    "AI",
    "Money",
    "Self Growth",
    "Productivity",
    "Technology",
    "Life",
    "Fitness",
  ];

  const tabsRef = useRef(null);
  const tabsSpacerRef = useRef(null);

  // Keep spacer height in sync — on mobile, tabs are always fixed so spacer is always needed
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');

    const updateSpacer = () => {
      if (!tabsSpacerRef.current || !tabsRef.current) return;
      tabsSpacerRef.current.style.height = mql.matches
        ? tabsRef.current.offsetHeight + 'px'
        : '0px';
    };

    updateSpacer();
    mql.addEventListener('change', updateSpacer);
    window.addEventListener('resize', updateSpacer);
    
    // Also use ResizeObserver to catch any height changes of the tabs themselves
    const resizeObserver = new ResizeObserver(updateSpacer);
    if (tabsRef.current) resizeObserver.observe(tabsRef.current);

    return () => {
      mql.removeEventListener('change', updateSpacer);
      window.removeEventListener('resize', updateSpacer);
      resizeObserver.disconnect();
    };
  }, []);

  const fetchLatestBlogs = ({page = 1}) => {
    api
      .post("/latest-blogs", { page })
      .then( async ({ data }) => {

        let formatedData = await filterPaginationData({
            state: blogs,
            data: data.blogs,
            page,
            countRoute: "/all-latest-blogs-count"
        })

        setBlogs(formatedData);
      })
      .catch((err) => {
        setFeedError(true);
      });
  };

  const fetchBlogsByCategory = ({ page = 1 }) => {
    api
      .post("/search-blogs", { tag: pageState, page })
      .then( async ({ data }) => {

       let formatedData = await filterPaginationData({
            state: blogs,
            data: data.blogs,
            page,
            countRoute: "/search-blogs-count",
            data_to_send: { tag: pageState }
        })

        setBlogs(formatedData);
      })
      .catch((err) => {
        setFeedError(true);
      });
  };

  const fetchTrendingBlogs = () => {
    api
      .get("/trending-blogs")
      .then(({ data }) => {
        setTrendingBlogs(data.blogs);
      })
      .catch((err) => {
        setTrendingError(true);
      });
  };

  // Following feed — blogs from people you follow
  const fetchFollowingBlogs = ({ page = 1 }) => {
    if (!access_token) return;
    
    api.post("/follow-feed", { page })
      .then(async ({ data }) => {
        let formatedData = await filterPaginationData({
          state: followingBlogs,
          data: data.blogs,
          page,
          countRoute: "/follow-feed-count",
        });
        setFollowingBlogs(formatedData);
      })
      .catch(() => { setFollowingError(true); });
  };

  const loadBlogByCategory = (category) => {
    window.scrollTo(0, 0);
    setFeedError(false);
    setFollowingError(false);

    if (category === "For You") {
      if (pageState !== "home") {
        setBlogs(null);
        setPageState("home");
      }
      return;
    }

    if (category === "Trending") {
      setPageState("trending");
      return;
    }

    if (category === "Following") {
      setPageState("following");
      return;
    }

    let tag = category.toLowerCase();
    if (pageState === tag) {
      setBlogs(null);
      setPageState("home");
      return;
    }

    setBlogs(null);
    setPageState(tag);
  };

  // Sync state → cache whenever it changes
  useEffect(() => { feedCache.blogs = blogs; }, [blogs]);
  useEffect(() => { feedCache.trendingBlogs = trendingBlogs; }, [trendingBlogs]);
  useEffect(() => { feedCache.followingBlogs = followingBlogs; }, [followingBlogs]);
  useEffect(() => { feedCache.pageState = pageState; }, [pageState]);

  // Restore scroll position on mount, save on unmount
  useEffect(() => {
    if (feedCache.scrollY > 0) {
      window.scrollTo({ top: feedCache.scrollY, left: 0, behavior: 'instant' });
    }
    return () => { feedCache.scrollY = window.scrollY; };
  }, []);

  useEffect(() => {
    if (pageState === "home") {
      if (!blogs) fetchLatestBlogs({ page: 1 });
    } else if (pageState === "following") {
      if (!followingBlogs) {
        fetchFollowingBlogs({ page: 1 });
      }
    } else if (pageState === "trending") {
      // handled separately
    } else {
      if (!blogs) fetchBlogsByCategory({ page: 1 });
    }

    if (!trendingBlogs) {
      fetchTrendingBlogs();
    }
  }, [pageState]);

  // Fetch liked status for visible blogs
  useEffect(() => {
    if (blogs?.results?.length && access_token) {
      let blogIds = blogs.results.map(b => b._id).filter(Boolean);
      if (blogIds.length) {
        api.post("/batch-isliked", { blog_ids: blogIds })
          .then(({ data }) => setLikedBlogs(data.likedBlogs || []))
          .catch(() => {});
      }
    } else {
      setLikedBlogs([]);
    }
  }, [blogs, access_token]);

  return (
    <AnimationWrapper>
      <div className="home-layout">

        {/* ── Main Feed Column ──────────────────── */}
        <div className="home-feed">

          {/* Sticky Feed Header */}
          <div className="feed-sticky-header">
            {/* Composer Prompt */}
            <div className="composer-prompt" onClick={() => access_token ? setShowComposer(true) : navigate("/signin")}>
                <div className="composer-prompt__avatar">
                    {profile_img ? (
                        <Avatar src={profile_img} size={36} />
                    ) : (
                        <div className="w-[36px] h-[36px] rounded-full bg-grey flex items-center justify-center text-dark-grey">
                            <Icon name="person" className="text-[20px]" />
                        </div>
                    )}
                </div>
                <span className="composer-prompt__input">Write to the world...</span>
                <div className="flex items-center gap-1 text-dark-grey ml-auto">
                    <div className="w-[44px] h-[44px] rounded-full hover:bg-grey flex items-center justify-center transition-colors" title="Add images">
                        <Icon name="image" className="text-[26px] text-brand" />
                    </div>
                    <div className="w-[44px] h-[44px] rounded-full hover:bg-grey flex items-center justify-center transition-colors" title="Add poll">
                        <Icon name="poll" className="text-[26px] text-brand" />
                    </div>
                </div>
            </div>

            {/* Category tabs */}
            <div className="category-tabs" ref={tabsRef}>
              <div className="flex items-center lg:hidden flex-shrink-0 py-2 -mr-2">
                  <Link 
                      to="/search/" 
                      className="flex items-center justify-center bg-grey hover:bg-border transition-colors rounded-radius-sm text-black"
                      style={{ width: "36px", height: "36px" }}
                  >
                      <Icon name="explore" className="text-xl" />
                  </Link>
                  <div className="h-6 w-[1px] bg-border ml-1"></div>
              </div>

              {categories.map((category, i) => {
                const isActive = 
                  (category === "For You" && pageState === "home") ||
                  (category === "Following" && pageState === "following") ||
                  (category === "Trending" && pageState === "trending") ||
                  (category !== "For You" && category !== "Following" && category !== "Trending" && pageState === category.toLowerCase());

                return (
                  <button
                    key={i}
                    onClick={() => loadBlogByCategory(category)}
                    className={"category-tabs__item" + (isActive ? " active" : "")}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
          {/* Spacer: fills the gap when category-tabs switches to position:fixed */}
          <div ref={tabsSpacerRef} className="category-tabs-spacer" style={{ height: 0 }} />

          {/* Blog feed */}
          <div className="home-feed__list">
            {pageState === "following" ? (
              // Following feed
              !access_token ? (
                <NoDataMessage message="Sign in to see blogs from people you follow" />
              ) : followingBlogs == null ? (
                followingError ? (
                  <NetworkError onRetry={() => { setFollowingError(false); setFollowingBlogs(null); fetchFollowingBlogs({ page: 1 }); }} />
                ) : (
                  <Loader />
                )
              ) : followingBlogs.results?.length ? (
                <>
                  {followingBlogs.results.map((blog, i) => (
                    <AnimationWrapper
                      key={blog.blog_id}
                      transition={{ duration: 0.4, delay: i * 0.04 }}
                    >
                      {blog.type === 'text_post' ? (
                        <TextPostCard
                          content={blog}
                          author={blog.author.personal_info}
                          onEdit={(blogId) => { setEditingTextPostId(blogId); setShowComposer(true); }}
                        />
                      ) : (
                        <BlogPostCard
                          content={blog}
                          author={blog.author.personal_info}
                          isLiked={likedBlogs.includes(blog._id)}
                        />
                      )}
                    </AnimationWrapper>
                  ))}
                  <LoadMoreDataBtn state={followingBlogs} fetchDataFun={fetchFollowingBlogs} />
                </>
              ) : (
                <div className="following-empty">
                  <Icon name="group_add" className="following-empty__icon" />
                  <h3 className="following-empty__title">Your Following feed is empty</h3>
                  <p className="following-empty__text">Follow writers to see their blogs here. Check out "Who to follow" in the sidebar!</p>
                </div>
              )
            ) : pageState === "trending" ? (
              <>
                <div className="trending-subtabs">
                  {[{key:"today",label:"Today"},{key:"week",label:"This Week"},{key:"month",label:"This Month"},{key:"all",label:"All Time"}].map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setTrendingFilter(tab.key)}
                      className={"trending-subtabs__item" + (trendingFilter === tab.key ? " active" : "")}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                {trendingBlogs == null ? (
                  trendingError ? (
                    <NetworkError onRetry={() => { setTrendingError(false); setTrendingBlogs(null); fetchTrendingBlogs(); }} />
                  ) : (
                    <Loader />
                  )
                ) :
                  (() => {
                    const now = new Date();
                    const filtered = trendingBlogs.filter(b => {
                      if (trendingFilter === "all") return true;
                      const published = new Date(b.publishedAt);
                      const diffDays = (now - published) / (1000 * 60 * 60 * 24);
                      if (trendingFilter === "today") return diffDays <= 1;
                      if (trendingFilter === "week") return diffDays <= 7;
                      if (trendingFilter === "month") return diffDays <= 30;
                      return true;
                    });
                    return filtered.length ?
                      filtered.map((blog, i) => (
                        <AnimationWrapper key={blog.blog_id} transition={{ duration: 0.4, delay: i * 0.04 }}>
                          {blog.type === 'text_post' ? (
                            <TextPostCard
                              content={blog}
                              author={blog.author.personal_info}
                              onEdit={(blogId) => { setEditingTextPostId(blogId); setShowComposer(true); }}
                            />
                          ) : (
                            <BlogPostCard
                              content={blog}
                              author={blog.author.personal_info}
                              isLiked={likedBlogs.includes(blog._id)}
                            />
                          )}
                        </AnimationWrapper>
                      ))
                    : <NoDataMessage message="No trending blogs for this period" />
                  })()}
              </>
            ) : blogs == null ? (
              feedError ? (
                <NetworkError onRetry={() => { setFeedError(false); setBlogs(null); feedCache.blogs = null; pageState === 'home' ? fetchLatestBlogs({ page: 1 }) : fetchBlogsByCategory({ page: 1 }); }} />
              ) : (
                <Loader />
              )
            ) : (
              blogs.results.length ?
                  blogs.results.map((blog, i) => {
                  return (
                      <AnimationWrapper
                      key={blog.blog_id}
                      transition={{ duration: 0.4, delay: i * 0.04 }}
                      >
                      {blog.type === 'text_post' ? (
                          <TextPostCard
                              content={blog}
                              author={blog.author.personal_info}
                              onEdit={(blogId) => { setEditingTextPostId(blogId); setShowComposer(true); }}
                          />
                      ) : (
                          <BlogPostCard
                              content={blog}
                              author={blog.author.personal_info}
                              isLiked={likedBlogs.includes(blog._id)}
                          />
                      )}
                      </AnimationWrapper>
                  );
                  })
              : <NoDataMessage message="No blogs published"/>
            )}
            {pageState !== "following" && pageState !== "trending" && <LoadMoreDataBtn state={blogs} fetchDataFun={( pageState === "home" ? fetchLatestBlogs : fetchBlogsByCategory )} />}
          </div>
        </div>

        {/* ── Right Sidebar Column (Desktop) ───── */}
        <RightSidebar onTrendingClick={() => loadBlogByCategory("Trending")} trendingBlogs={trendingBlogs} />

      </div>


      {/* Text Post Composer Modal */}
      <TextPostComposer
        isOpen={showComposer}
        onClose={() => { setShowComposer(false); setEditingTextPostId(null); }}
        editBlogId={editingTextPostId}
        onPosted={() => {
            // Refresh feed after posting
            setBlogs(null);
            feedCache.blogs = null;
            fetchLatestBlogs({ page: 1 });
        }}
      />
    </AnimationWrapper>
  );
};

export default HomePage;
