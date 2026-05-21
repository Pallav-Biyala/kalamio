import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import { UserContext } from "../App";
import Icon from "../components/Icon";
import toast from "react-hot-toast";

const CreatePublicationPage = () => {

    usePageTitle('Create Publication');

    const { userAuth: { access_token } } = useContext(UserContext);
    const navigate = useNavigate();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleAddTag = (e) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            const tag = tagInput.trim().toLowerCase();
            if (tag && !tags.includes(tag) && tags.length < 10) {
                setTags([...tags, tag]);
            }
            setTagInput("");
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            return toast.error("Publication title is required");
        }

        setLoading(true);

        try {
            const { data } = await api.post("/publication/create", {
                title: title.trim(),
                description: description.trim(),
                tags
            });

            toast.success("Publication created!");
            navigate(`/publication/${data.publication.slug}`);
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to create publication");
        } finally {
            setLoading(false);
        }
    };

    if (!access_token) {
        navigate("/signin");
        return null;
    }

    return (
        <AnimationWrapper>
            <div className="create-pub">
                <h1 className="create-pub__title">
                    <Icon name="library_add" className="create-pub__title-icon" />
                    Create Publication
                </h1>
                <p className="create-pub__subtitle">
                    Publications are named content channels — like a newsletter or magazine. 
                    Organize your blogs and let readers subscribe specifically to topics they love.
                </p>

                <form onSubmit={handleSubmit} className="create-pub__form">
                    {/* Title */}
                    <div className="create-pub__field">
                        <label className="create-pub__label">Title</label>
                        <input
                            type="text"
                            className="create-pub__input"
                            placeholder='e.g. "Design Systems Weekly"'
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={100}
                        />
                        <span className="create-pub__hint">{title.length}/100</span>
                    </div>

                    {/* Description */}
                    <div className="create-pub__field">
                        <label className="create-pub__label">Description</label>
                        <textarea
                            className="create-pub__textarea"
                            placeholder="What is this publication about?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            maxLength={500}
                            rows={3}
                        />
                        <span className="create-pub__hint">{description.length}/500</span>
                    </div>

                    {/* Tags */}
                    <div className="create-pub__field">
                        <label className="create-pub__label">Topics</label>
                        <div className="create-pub__tags-container">
                            {tags.map((tag, i) => (
                                <span key={i} className="create-pub__tag">
                                    {tag}
                                    <button type="button" onClick={() => handleRemoveTag(tag)} className="create-pub__tag-remove">
                                        <Icon name="close" className="text-sm" />
                                    </button>
                                </span>
                            ))}
                            <input
                                type="text"
                                className="create-pub__tag-input"
                                placeholder={tags.length < 10 ? "Add topic (press Enter)" : "Max 10 topics"}
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                disabled={tags.length >= 10}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="create-pub__submit"
                        disabled={loading || !title.trim()}
                    >
                        {loading ? "Creating..." : "Create Publication"}
                    </button>
                </form>
            </div>
        </AnimationWrapper>
    );
};

export default CreatePublicationPage;
