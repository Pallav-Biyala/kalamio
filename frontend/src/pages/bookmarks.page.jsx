import { useContext, useEffect, useState } from "react";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import api from "../common/api";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import toast from "react-hot-toast";

const CollectionCard = ({ collection, onDelete }) => {
    const visibilityIcon = collection.visibility === 'public' ? 'public' : collection.visibility === 'unlisted' ? 'link' : 'lock';

    return (
        <Link to={`/collection/${collection._id}`} className="saved-collection-card">
            <div className="saved-collection-card__cover">
                {collection.cover_image ? (
                    <img src={collection.cover_image} alt={collection.title} />
                ) : (
                    <div className="saved-collection-card__cover-placeholder">
                        <Icon name={collection.is_default ? "schedule" : "collections_bookmark"} className="text-3xl" />
                    </div>
                )}
                <span className="saved-collection-card__count">
                    {collection.total_articles} {collection.total_articles === 1 ? 'article' : 'articles'}
                </span>
            </div>
            <div className="saved-collection-card__info">
                <h3 className="saved-collection-card__title">
                    {collection.is_default && <Icon name="schedule" className="text-sm mr-1" />}
                    {collection.title}
                </h3>
                <div className="saved-collection-card__meta">
                    <span className="saved-collection-card__visibility">
                        <Icon name={visibilityIcon} className="text-xs" />
                        {collection.visibility}
                    </span>
                    {!collection.is_default && onDelete && (
                        <button
                            className="saved-collection-card__delete"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm(`Delete "${collection.title}"?`)) onDelete(collection._id);
                            }}
                        >
                            <Icon name="delete_outline" className="text-sm" />
                        </button>
                    )}
                </div>
            </div>
        </Link>
    );
};

const SavedPage = () => {

    usePageTitle('Saved');

    const { userAuth: { access_token, username } } = useContext(UserContext);
    const [collections, setCollections] = useState(null);
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newVisibility, setNewVisibility] = useState("private");
    const [showVisibilityDropdown, setShowVisibilityDropdown] = useState(false);

    const fetchCollections = () => {
        api.post("/collection/user-collections", { username })
            .then(({ data }) => setCollections(data.collections))
            .catch(() => setCollections([]));
    };

    useEffect(() => {
        if (access_token && username) fetchCollections();
    }, [access_token, username]);

    const handleCreate = () => {
        if (!newTitle.trim()) return;

        api.post("/collection/create", { title: newTitle.trim(), visibility: newVisibility })
            .then(({ data }) => {
                setCollections(prev => [...prev, data.collection]);
                setNewTitle("");
                setCreating(false);
                toast.success(`Created "${data.collection.title}"`);
            })
            .catch(err => toast.error(err.response?.data?.error || "Failed to create"));
    };

    const handleDelete = (collectionId) => {
        api.post("/collection/delete", { collection_id: collectionId })
            .then(() => {
                setCollections(prev => prev.filter(c => c._id !== collectionId));
                toast.success("Collection deleted");
            })
            .catch(err => toast.error(err.response?.data?.error || "Failed to delete"));
    };

    return (
        <AnimationWrapper className="px-4 py-4 md:px-8 lg:pt-5 max-w-[900px] mx-auto w-full">
            <div className="saved-page__header">
                <h1 className="max-md:hidden">Saved</h1>
                <button className="btn-dark btn-sm" onClick={() => setCreating(!creating)}>
                    <Icon name="add" className="text-lg" />
                    New Collection
                </button>
            </div>

            {creating && (
                <div className="saved-page__create-form">
                    <input
                        type="text"
                        placeholder="Collection name..."
                        className="input-box"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                        maxLength={100}
                        autoFocus
                    />
                    <div className="saved-page__create-row">
                        <div className="relative" tabIndex={0} onBlur={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget)) {
                                setShowVisibilityDropdown(false);
                            }
                        }}>
                            <button
                                className="input-box saved-page__create-select flex items-center justify-between gap-1 w-[130px] capitalize px-3"
                                onClick={() => setShowVisibilityDropdown(!showVisibilityDropdown)}
                            >
                                <span className="flex items-center gap-2">
                                    <Icon name={newVisibility === 'public' ? 'public' : newVisibility === 'unlisted' ? 'link' : 'lock'} className="text-sm" />
                                    {newVisibility}
                                </span>
                                <Icon name="expand_more" className="text-lg text-dark-grey" />
                            </button>
                            
                            {showVisibilityDropdown && (
                                <div className="absolute top-full mt-1 left-0 w-[140px] bg-surface border border-border rounded-md shadow-lg overflow-hidden z-10 flex flex-col p-1">
                                    {['private', 'public', 'unlisted'].map(opt => (
                                        <button
                                            key={opt}
                                            className={"px-3 py-2 text-left flex items-center justify-between text-sm capitalize hover:bg-grey/60 transition-colors rounded-sm " + (newVisibility === opt ? "bg-grey font-medium" : "text-dark-grey")}
                                            onClick={() => {
                                                setNewVisibility(opt);
                                                setShowVisibilityDropdown(false);
                                            }}
                                        >
                                            <span className="flex items-center gap-2">
                                                <Icon name={opt === 'public' ? 'public' : opt === 'unlisted' ? 'link' : 'lock'} className="text-sm" />
                                                {opt}
                                            </span>
                                            {newVisibility === opt && <Icon name="check" className="text-sm" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn-dark btn-sm" onClick={handleCreate} disabled={!newTitle.trim()}>Create</button>
                            <button className="btn-light btn-sm" onClick={() => setCreating(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="saved-page__grid">
                {collections === null ? (
                    <Loader />
                ) : collections.length === 0 ? (
                    <NoDataMessage message="No collections yet. Save articles or create a collection!" />
                ) : (
                    collections.map(col => (
                        <CollectionCard key={col._id} collection={col} onDelete={handleDelete} />
                    ))
                )}
            </div>
        </AnimationWrapper>
    );
};

export default SavedPage;
