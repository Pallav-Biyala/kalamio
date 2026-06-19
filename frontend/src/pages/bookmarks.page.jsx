import { useContext, useEffect, useState } from "react";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import api from "../common/api";
import { filterPaginationData } from "../common/filter-pagination-data";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import { Link } from "react-router-dom";
import { getRelativeTime } from "../common/date";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import toast from "react-hot-toast";

const BookmarkCard = ({ blog, onRemove }) => {

    const { blog_id, title, banner, description, tags, activity, publishedAt, text_content, post_type, author: { personal_info: { fullname, username, profile_img } } } = blog;

    const isTextPost = post_type === 'text_post';

    const displayTitle = isTextPost
        ? (text_content ? text_content.substring(0, 100) + (text_content.length > 100 ? '...' : '') : 'Text Post')
        : title;

    return (
        <AnimationWrapper>
            <div className="flex gap-5 border-b border-border pb-5 mb-5 items-start">

                {!isTextPost && banner && (
                    <Link to={`/blog/${blog_id}`} className="shrink-0">
                        <img src={banner} className="w-24 h-24 object-cover rounded-radius-md bg-grey" alt={displayTitle} />
                    </Link>
                )}

                <div className="flex-1 min-w-0">
                    <Link to={`/user/${username}`} className="flex items-center gap-2 mb-2">
                        <Avatar src={profile_img} alt={username} size={20} />
                        <span className="text-sm text-dark-grey">{fullname}</span>
                        <span className="text-xs text-dark-grey">· {getRelativeTime(publishedAt)}</span>
                    </Link>

                    <Link to={`/blog/${blog_id}`}>
                        <h3 className="text-lg font-semibold text-black leading-snug line-clamp-2 hover:underline">
                            {displayTitle}
                        </h3>
                    </Link>

                    {!isTextPost && description && (
                        <p className="text-sm text-dark-grey mt-1 line-clamp-2">{description}</p>
                    )}

                    <div className="flex items-center gap-4 mt-3">
                        <span className="text-xs text-dark-grey flex items-center gap-1">
                            <Icon name="favorite" className="text-[14px]" />
                            {activity?.total_likes || 0}
                        </span>
                        <span className="text-xs text-dark-grey flex items-center gap-1">
                            <Icon name="chat_bubble" className="text-[14px]" />
                            {activity?.total_comments || 0}
                        </span>
                        <button
                            onClick={() => onRemove(blog_id)}
                            className="ml-auto text-xs text-dark-grey hover:text-red transition-colors flex items-center gap-1"
                        >
                            <Icon name="bookmark_remove" className="text-[16px]" />
                            Remove
                        </button>
                    </div>
                </div>
            </div>
        </AnimationWrapper>
    );
};

const BookmarksPage = () => {

    usePageTitle('Bookmarks');

    const { userAuth: { access_token } } = useContext(UserContext);
    const [bookmarks, setBookmarks] = useState(null);

    const fetchBookmarks = ({ page = 1, create_new_arr = false }) => {
        api.post("/bookmarks", { page })
        .then(async ({ data }) => {
            let formatedData = await filterPaginationData({
                state: bookmarks,
                data: data.bookmarks,
                page,
                countRoute: "/bookmarks-count",
                create_new_arr
            });
            setBookmarks(formatedData);
        })
        .catch(err => {
            console.error(err);
        });
    };

    useEffect(() => {
        if (access_token) {
            fetchBookmarks({ page: 1, create_new_arr: true });
        }
    }, [access_token]);

    const handleRemoveBookmark = (blog_id) => {
        api.post("/remove-bookmark", { blog_id })
        .then(() => {
            // Remove from local state
            setBookmarks(prev => {
                if (!prev) return prev;
                const newResults = prev.results.filter(b => b.blog.blog_id !== blog_id);
                return {
                    ...prev,
                    results: newResults,
                    totalDocs: prev.totalDocs - 1
                };
            });
            toast.success("Bookmark removed");
        })
        .catch(err => {
            toast.error("Failed to remove bookmark");
        });
    };

    return (
        <AnimationWrapper>
            <h1 className="max-md:hidden">Bookmarks</h1>

            <div className="mt-7">
                {bookmarks === null ? (
                    <Loader />
                ) : bookmarks.results.length === 0 ? (
                    <NoDataMessage message="No bookmarks yet. Save articles to read later!" />
                ) : (
                    <>
                        {bookmarks.results.map((bookmark, i) => (
                            <BookmarkCard
                                key={i}
                                blog={bookmark.blog}
                                onRemove={handleRemoveBookmark}
                            />
                        ))}

                        <LoadMoreDataBtn
                            state={bookmarks}
                            fetchDataFun={fetchBookmarks}
                        />
                    </>
                )}
            </div>
        </AnimationWrapper>
    );
};

export default BookmarksPage;
