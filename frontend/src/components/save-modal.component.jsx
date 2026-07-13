import { useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserContext } from "../App";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import api from "../common/api";
import Icon from "./Icon";
import toast from "react-hot-toast";

const SaveModal = ({ blogId, isOpen, onClose }) => {
    const { userAuth: { access_token } } = useContext(UserContext);
    const queryClient = useQueryClient();
    const [collections, setCollections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newVisibility, setNewVisibility] = useState("private");
    const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);

    // Invalidate isSaved + collections caches when modal closes
    const handleClose = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.collections.isSaved(blogId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.collections.all() });
        onClose();
    };

    useEffect(() => {
        if (!isOpen || !access_token || !blogId) return;
        setLoading(true);
        api.post("/collection/article-collections", { blog_id: blogId })
            .then(({ data }) => {
                setCollections(data.collections);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [isOpen, blogId, access_token]);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
            document.documentElement.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
            document.documentElement.style.overflow = "unset";
        }
    }, [isOpen]);

    const toggleCollection = (collectionId, currentlyContains) => {
        const endpoint = currentlyContains ? "/collection/remove-article" : "/collection/add-article";

        // Optimistic update
        setCollections(prev => prev.map(c =>
            c._id === collectionId
                ? { ...c, contains_article: !currentlyContains, total_articles: c.total_articles + (currentlyContains ? -1 : 1) }
                : c
        ));

        api.post(endpoint, { collection_id: collectionId, blog_id: blogId })
            .catch(() => {
                // Revert on error
                setCollections(prev => prev.map(c =>
                    c._id === collectionId
                        ? { ...c, contains_article: currentlyContains, total_articles: c.total_articles + (currentlyContains ? 1 : -1) }
                        : c
                ));
                toast.error("Failed to update collection");
            });
    };

    const handleCreate = () => {
        if (!newTitle.trim()) return;
        setCreating(true);

        api.post("/collection/create", { title: newTitle.trim(), visibility: newVisibility })
            .then(({ data }) => {
                // Add the new collection and then add article to it
                const newCol = {
                    _id: data.collection._id,
                    title: data.collection.title,
                    slug: data.collection.slug,
                    visibility: data.collection.visibility,
                    is_default: false,
                    total_articles: 0,
                    contains_article: false
                };
                setCollections(prev => [...prev, newCol]);
                setNewTitle("");
                setCreating(false);

                // Auto-add article to the new collection
                toggleCollection(data.collection._id, false);
                toast.success(`Created "${data.collection.title}"`);
            })
            .catch(err => {
                toast.error(err.response?.data?.error || "Failed to create collection");
                setCreating(false);
            });
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="save-modal__portal" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
            <div className="save-modal__backdrop" onClick={handleClose} />
            <div className="save-modal">
                <div className="save-modal__header">
                    <h3>Save to...</h3>
                    <button className="save-modal__close" onClick={handleClose}>
                        <Icon name="close" />
                    </button>
                </div>

                <div className="save-modal__list">
                    {loading ? (
                        <div className="save-modal__loading">Loading collections...</div>
                    ) : collections.length === 0 ? (
                        <div className="save-modal__empty">No collections yet. Create one below!</div>
                    ) : (
                        collections.map(col => (
                            <div 
                                key={col._id} 
                                className="save-modal__item cursor-pointer"
                                onClick={() => toggleCollection(col._id, col.contains_article)}
                            >
                                <div className="save-modal__item-info">
                                    <span className="save-modal__item-title">
                                        {col.is_default && <Icon name="schedule" className="text-sm mr-1" />}
                                        {col.title}
                                    </span>
                                    <span className="save-modal__item-meta">
                                        {col.total_articles} {col.total_articles === 1 ? 'article' : 'articles'}
                                        {col.visibility !== 'private' && (
                                            <span className="save-modal__visibility-badge">
                                                <Icon name={col.visibility === 'public' ? 'public' : 'link'} className="text-xs" />
                                                {col.visibility}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="save-modal__checkbox-icon">
                                    <Icon name="bookmark" filled={col.contains_article} className="text-3xl text-dark-grey" />
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <div className="save-modal__create">
                    <div className="save-modal__create-row">
                        <input
                            type="text"
                            placeholder="New collection name..."
                            className="save-modal__create-input"
                            value={newTitle}
                            onChange={(e) => setNewTitle(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            maxLength={100}
                        />
                        <div className="relative" tabIndex={0} onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget)) {
                                setShowVisibilityDropdown(false);
                            }
                        }}>
                            <button
                                className="save-modal__create-select flex items-center justify-between gap-1 w-[110px] capitalize"
                                onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                            >
                                <span className="flex items-center gap-1.5">
                                    <Icon name={newVisibility === 'public' ? 'public' : newVisibility === 'unlisted' ? 'link' : 'lock'} className="text-sm" />
                                    {newVisibility}
                                </span>
                                <Icon name="expand_more" className="text-lg text-dark-grey" />
                            </button>
                            
                            {showVisibilityDropdown && (
                                <div className="absolute bottom-full mb-2 right-0 w-32 bg-surface border border-border rounded-md shadow-lg overflow-hidden z-10 flex flex-col p-1">
                                    {['private', 'public', 'unlisted'].map(opt => (
                                        <button
                                            key={opt}
                                            className={"px-3 py-1.5 text-left flex items-center justify-between text-sm capitalize hover:bg-grey/60 transition-colors rounded-sm " + (newVisibility === opt ? "bg-grey font-medium" : "text-dark-grey")}
                                            onClick={() => {
                                                setNewVisibility(opt);
                                                setShowVisibilityDropdown(false);
                                            }}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                <Icon name={opt === 'public' ? 'public' : opt === 'unlisted' ? 'link' : 'lock'} className="text-sm" />
                                                {opt}
                                            </span>
                                            {newVisibility === opt && <Icon name="check" className="text-sm" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <button
                        className="save-modal__create-btn"
                        onClick={handleCreate}
                        disabled={!newTitle.trim() || creating}
                    >
                        <Icon name="add" className="text-lg" />
                        {creating ? "Creating..." : "Create"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SaveModal;
