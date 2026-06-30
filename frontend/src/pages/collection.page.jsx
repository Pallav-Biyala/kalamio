import { useContext, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { UserContext } from "../App";
import api from "../common/api";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import BlogPostCard from "../components/blog-post.component";
import TextPostCard from "../components/text-post-card.component";
import NoDataMessage from "../components/nodata.component";
import toast from "react-hot-toast";

const CollectionPage = () => {
    const { userAuth: { access_token, username: currentUser } } = useContext(UserContext);
    const { collectionId } = useParams();

    const [collection, setCollection] = useState(null);
    const [articles, setArticles] = useState([]);
    const [page, setPage] = useState(1);
    const [totalDocs, setTotalDocs] = useState(0);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [editDesc, setEditDesc] = useState("");
    const [editVisibility, setEditVisibility] = useState("private");
    const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);

    const fetchCollection = (p = 1) => {
        setLoading(true);
        api.post("/collection/get", { collection_id: collectionId, page: p })
            .then(({ data }) => {
                setCollection(data.collection);
                setArticles(prev => p === 1 ? data.articles : [...prev, ...data.articles]);
                setTotalDocs(data.totalDocs);
                setEditTitle(data.collection.title);
                setEditDesc(data.collection.description);
                setEditVisibility(data.collection.visibility);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    };

    useEffect(() => { fetchCollection(); }, [collectionId]);

    const handleUpdate = () => {
        api.post("/collection/update", {
            collection_id: collectionId,
            title: editTitle,
            description: editDesc,
            visibility: editVisibility
        }).then(({ data }) => {
            setCollection(data.collection);
            setEditing(false);
            toast.success("Collection updated");
        }).catch(err => toast.error(err.response?.data?.error || "Update failed"));
    };

    const handleRemoveArticle = (blogId) => {
        api.post("/collection/remove-article", { collection_id: collectionId, blog_id: blogId })
            .then(() => {
                setArticles(prev => prev.filter(a => a.blog.blog_id !== blogId));
                setTotalDocs(prev => prev - 1);
                setCollection(prev => ({ ...prev, total_articles: prev.total_articles - 1 }));
                toast.success("Removed from collection");
            })
            .catch(() => toast.error("Failed to remove"));
    };

    if (loading && !collection) {
        return <div className="dashboard-page__loading"><div className="loader" /></div>;
    }

    if (!collection) {
        return <div className="dashboard-page"><NoDataMessage message="Collection not found" /></div>;
    }

    const visibilityIcon = collection.visibility === 'public' ? 'public' : collection.visibility === 'unlisted' ? 'link' : 'lock';

    return (
        <div className="collection-detail">
            <div className="collection-detail__header">
                {editing ? (
                    <div className="collection-detail__edit-form">
                        <input
                            type="text"
                            className="collection-detail__edit-input"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            placeholder="Collection title"
                            disabled={collection.is_default}
                        />
                        <textarea
                            className="collection-detail__edit-textarea"
                            value={editDesc}
                            onChange={(e) => setEditDesc(e.target.value)}
                            placeholder="Description (optional)"
                            rows={3}
                        />
                        <div className="collection-detail__edit-actions">
                            <div className="relative" tabIndex={0} onBlur={(e) => {
                                if (!e.currentTarget.contains(e.relatedTarget)) {
                                    setShowVisibilityDropdown(false);
                                }
                            }}>
                                <button
                                    className="collection-detail__edit-select flex items-center justify-between gap-1 w-[120px] capitalize"
                                    onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Icon name={editVisibility === 'public' ? 'public' : editVisibility === 'unlisted' ? 'link' : 'lock'} className="text-sm" />
                                        {editVisibility}
                                    </span>
                                    <Icon name="expand_more" className="text-lg text-dark-grey" />
                                </button>
                                
                                {showVisibilityDropdown && (
                                    <div className="absolute top-full mt-1 left-0 w-32 bg-surface border border-border rounded-md shadow-lg overflow-hidden z-10 flex flex-col p-1">
                                        {['private', 'public', 'unlisted'].map(opt => (
                                            <button
                                                key={opt}
                                                className={"px-3 py-1.5 text-left flex items-center justify-between text-sm capitalize hover:bg-grey/60 transition-colors rounded-sm " + (editVisibility === opt ? "bg-grey font-medium" : "text-dark-grey")}
                                                onClick={() => {
                                                    setEditVisibility(opt);
                                                    setShowVisibilityDropdown(false);
                                                }}
                                            >
                                                <span className="flex items-center gap-1.5">
                                                    <Icon name={opt === 'public' ? 'public' : opt === 'unlisted' ? 'link' : 'lock'} className="text-sm" />
                                                    {opt}
                                                </span>
                                                {editVisibility === opt && <Icon name="check" className="text-sm" />}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button className="btn-dark" onClick={handleUpdate}>Save</button>
                                <button className="btn-light" onClick={() => setEditing(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="collection-detail__title-row">
                            <h1>{collection.title}</h1>
                            <span className="collection-detail__visibility">
                                <Icon name={visibilityIcon} className="text-sm" />
                                {collection.visibility}
                            </span>
                        </div>
                        {collection.description && (
                            <p className="collection-detail__desc">{collection.description}</p>
                        )}
                        <div className="collection-detail__meta">
                            <Link to={`/user/${collection.owner.personal_info.username}`} className="collection-detail__owner">
                                <Avatar src={collection.owner.personal_info.profile_img} size="sm" />
                                <span>{collection.owner.personal_info.fullname}</span>
                            </Link>
                            <span className="collection-detail__count">
                                {collection.total_articles} {collection.total_articles === 1 ? 'article' : 'articles'}
                            </span>
                        </div>
                        {collection.is_owner && !collection.is_default && (
                            <button className="collection-detail__edit-btn" onClick={() => setEditing(true)}>
                                <Icon name="edit" className="text-sm" /> Edit
                            </button>
                        )}
                    </>
                )}
            </div>

            <div className="collection-detail__articles">
                {articles.length === 0 ? (
                    <NoDataMessage message="No articles in this collection yet" />
                ) : (
                    articles.map((item, i) => (
                        <div key={item.blog._id || i} className="collection-detail__article-item">
                            {item.blog.post_type === 'text_post' ? (
                                <TextPostCard content={item.blog} author={item.blog.author.personal_info} />
                            ) : (
                                <BlogPostCard content={item.blog} author={item.blog.author.personal_info} />
                            )}
                            {collection.is_owner && (
                                <button
                                    className="collection-detail__remove-btn"
                                    onClick={() => handleRemoveArticle(item.blog.blog_id)}
                                >
                                    <Icon name="close" className="text-sm" /> Remove
                                </button>
                            )}
                        </div>
                    ))
                )}
            </div>

            {articles.length < totalDocs && (
                <button
                    className="btn-light collection-detail__load-more"
                    onClick={() => { const next = page + 1; setPage(next); fetchCollection(next); }}
                >
                    Load More
                </button>
            )}
        </div>
    );
};

export default CollectionPage;
