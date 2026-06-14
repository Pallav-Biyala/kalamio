import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import { UserContext } from "../App";
import Icon from "../components/Icon";
import toast from "react-hot-toast";
import { uploadImage } from "../common/aws";

const CreatePublicationPage = () => {

    usePageTitle('Create Publication');

    const { userAuth: { access_token } } = useContext(UserContext);
    const navigate = useNavigate();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState([]);
    const [banner, setBanner] = useState("");
    const [profilePhoto, setProfilePhoto] = useState("");
    const [social_links, setSocialLinks] = useState({
        youtube: "",
        instagram: "",
        facebook: "",
        twitter: "",
        github: "",
        website: ""
    });
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

    const handleBannerUpload = (e) => {
        let img = e.target.files[0];
        if (img) {
            let loadingToast = toast.loading("Uploading banner...");
            uploadImage(img)
                .then((url) => {
                    if (url) {
                        setBanner(url);
                        toast.dismiss(loadingToast);
                        toast.success("Uploaded 👍");
                    }
                })
                .catch((err) => {
                    toast.dismiss(loadingToast);
                    return toast.error(err);
                });
        }
    };

    const handleProfilePhotoUpload = (e) => {
        let img = e.target.files[0];
        if (img) {
            let loadingToast = toast.loading("Uploading profile photo...");
            uploadImage(img)
                .then((url) => {
                    if (url) {
                        setProfilePhoto(url);
                        toast.dismiss(loadingToast);
                        toast.success("Uploaded 👍");
                    }
                })
                .catch((err) => {
                    toast.dismiss(loadingToast);
                    return toast.error(err);
                });
        }
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
                banner,
                profile_photo: profilePhoto,
                tags,
                social_links
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
                    {/* Banner and Profile Photo */}
                    <div className="create-pub__field">
                        <label className="create-pub__label">Publication Visuals</label>
                        <div className="relative mb-16">
                            {/* Banner Upload */}
                            <div className="relative aspect-video bg-grey overflow-hidden rounded-xl group hover:opacity-90 transition-opacity cursor-pointer border-2 border-dashed border-border">
                                <label htmlFor="uploadBanner" className="absolute inset-0 z-10 cursor-pointer">
                                    {banner ? (
                                        <img src={banner} className="w-full h-full object-cover" alt="Publication Banner" />
                                    ) : (
                                        <div className="flex flex-col items-center justify-center w-full h-full text-dark-grey">
                                            <Icon name="add_photo_alternate" className="text-4xl mb-2" />
                                            <span>Upload a banner image</span>
                                        </div>
                                    )}
                                    <input
                                        id="uploadBanner"
                                        type="file"
                                        accept=".png, .jpg, .jpeg"
                                        hidden
                                        onChange={handleBannerUpload}
                                    />
                                </label>
                            </div>

                            {/* Profile Photo Upload */}
                            <div className="absolute -bottom-10 left-8 z-20">
                                <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-md overflow-hidden group hover:opacity-90 transition-opacity cursor-pointer relative flex items-center justify-center bg-grey">
                                    <label htmlFor="uploadProfilePhoto" className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center bg-grey">
                                        {profilePhoto ? (
                                            <img src={profilePhoto} className="w-full h-full object-cover" alt="Profile" />
                                        ) : (
                                            <Icon name="add_a_photo" className="text-3xl text-dark-grey" />
                                        )}
                                        <input
                                            id="uploadProfilePhoto"
                                            type="file"
                                            accept=".png, .jpg, .jpeg"
                                            hidden
                                            onChange={handleProfilePhotoUpload}
                                        />
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>

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

                    {/* Social Links */}
                    <div className="create-pub__field">
                        <label className="create-pub__label">Social Links</label>
                        <p className="text-dark-grey text-sm mb-4">
                            Add social links specifically for this publication. You can also just add your personal social links here if you want!
                        </p>
                        
                        <div className="flex flex-col gap-3">
                            {Object.keys(social_links).map((key, i) => (
                                <div key={i} className="flex items-center bg-grey rounded-md px-4 py-2 border border-grey focus-within:border-black/20">
                                    <Icon name={key === 'website' ? 'language' : 'link'} className="text-xl text-dark-grey mr-3" />
                                    <input 
                                        type="text" 
                                        placeholder={`https://${key}.com/...`}
                                        className="bg-transparent border-none outline-none w-full placeholder-dark-grey/50"
                                        value={social_links[key]}
                                        onChange={(e) => setSocialLinks({ ...social_links, [key]: e.target.value })}
                                    />
                                </div>
                            ))}
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
