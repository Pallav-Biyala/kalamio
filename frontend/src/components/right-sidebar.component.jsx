import { useContext, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../common/api";
import Icon from "./Icon";
import AnimationWrapper from "../common/page-animation";
import Loader from "./loader.component";
import NoDataMessage from "./nodata.component";
import MinimalBlogPost from "./nobanner-blog-post.component";
import WhoToFollow from "./who-to-follow.component";
import { UserContext } from "../App";

const RightSidebar = ({ onTrendingClick, trendingBlogs: trendingBlogsProp }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [trendingBlogs, setTrendingBlogs] = useState(trendingBlogsProp ?? null);
  const navigate = useNavigate();

  // Sync prop → state when parent provides data
  useEffect(() => {
    if (trendingBlogsProp != null) {
      setTrendingBlogs(trendingBlogsProp);
    }
  }, [trendingBlogsProp]);

  // Only fetch independently if no prop was provided (e.g. used outside HomePage)
  useEffect(() => {
    if (trendingBlogsProp != null) return; // parent already provides data
    api.get("/trending-blogs")
      .then(({ data }) => {
        setTrendingBlogs(data.blogs);
      })
      .catch((err) => {
        console.error("Failed to fetch trending blogs", err);
      });
  }, []);

  const handleTrendingClick = () => {
    if (onTrendingClick) {
        onTrendingClick();
    } else {
        navigate("/search/trending");
    }
  };

  return (
    <aside className="home-sidebar">
      {/* Search Bar */}
      <div className="desktop-top-bar__search mb-4">
        <Icon name="search" className="text-lg text-dark-grey" />
        <input
          type="text"
          placeholder="Search"
          className="desktop-top-bar__search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && searchQuery.length) navigate(`/search/${searchQuery}`); }}
        />
        {searchQuery.length > 0 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchQuery("")} className="text-dark-grey hover:text-black flex items-center justify-center p-0.5 transition-colors">
              <Icon name="close" className="text-lg" />
            </button>
          </div>
        )}
      </div>

      {/* Trending Now */}
      <div className="home-sidebar__section">
        <div className="home-sidebar__header">
          <div className="home-sidebar__title">
            <Icon name="trending_up" /> Trending Now
          </div>
          <span className="home-sidebar__view-all" onClick={handleTrendingClick}>View all</span>
        </div>

        <div className="home-sidebar__list">
          {trendingBlogs == null ? (
            <Loader />
          ) : (
            trendingBlogs.length ?
                trendingBlogs.slice(0, 5).map((blog, i) => {
                return (
                    <AnimationWrapper
                    key={blog.blog_id}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    >
                    <MinimalBlogPost blog={blog} index={i} />
                    </AnimationWrapper>
                );
                })
            : <NoDataMessage message="No trending blogs"/>
          )}
        </div>
      </div>

      {/* Who to Follow */}
      <WhoToFollow />

      {/* Footer links */}
      <div className="home-sidebar__footer">
        <a href="#" className="home-sidebar__footer-link">About</a>
        <a href="#" className="home-sidebar__footer-link">Help</a>
        <a href="#" className="home-sidebar__footer-link">Terms</a>
        <a href="#" className="home-sidebar__footer-link">Privacy</a>
      </div>
    </aside>
  );
};

export default RightSidebar;
