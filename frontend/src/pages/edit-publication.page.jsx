import api from "../common/api";
import usePageTitle from "../common/usePageTitle";
import { useContext, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AnimationWrapper from "../common/page-animation";
import { UserContext } from "../App";
import Icon from "../components/Icon";
import toast from "react-hot-toast";
import { uploadImage } from "../common/aws";
import Loader from "../components/loader.component";
import ConfirmModal from "../components/confirm-modal.component";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../common/queryKeys";
import ImageCropperModal from "../components/image-cropper.component";

// The publication banner renders as a wide, fixed-height strip (object-fit: cover); cropping to this
// aspect lets the user pick exactly what shows instead of an arbitrary centre crop of a big upload.
const BANNER_ASPECT = 4;

const EditPublicationPage = () => {

    usePageTitle('Edit Publication');

    let { slug } = useParams();
    const { userAuth: { access_token } } = useContext(UserContext);
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [pubId, setPubId] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [banner, setBanner] = useState("");
    const [bannerToCrop, setBannerToCrop] = useState(null); // object URL of the image being cropped
    const [profilePhoto, setProfilePhoto] = useState("");
    const [profileToCrop, setProfileToCrop] = useState(null); // object URL of the photo being cropped
    const [social_links, setSocialLinks] = useState({
        youtube: "",
        instagram: "",
        facebook: "",
        twitter: "",
        github: "",
        website: ""
    });
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null);

    useEffect(() => {
        api.post("/publication/get", { slug })
            .then(({ data }) => {
                const pub = data.publication;
                setPubId(pub._id);
                setTitle(pub.title);
                setDescription(pub.description || "");
                setTags(pub.tags || []);
                setBanner(pub.banner || "");
                setProfilePhoto(pub.profile_photo || "");
                if (pub.social_links) {
                    setSocialLinks(pub.social_links);
                }
                setPageLoading(false);
            })
            .catch((err) => {
                toast.error("Failed to load publication");
                navigate("/dashboard/publications");
            });
    }, [slug, navigate]);

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

    // Pick a file → open the cropper (don't upload the raw image). Reset the input value so choosing
    // the SAME file again still fires onChange.
    const handleBannerUpload = (e) => {
        const img = e.target.files[0];
        if (img) setBannerToCrop(URL.createObjectURL(img));
        e.target.value = null;
    };

    // Cropper returns the cropped banner as a File → upload that.
    const handleBannerCropped = (croppedFile) => {
        setBannerToCrop(null);
        const loadingToast = toast.loading("Uploading banner…");
        uploadImage(croppedFile)
            .then((url) => {
                if (url) {
                    setBanner(url);
                    toast.dismiss(loadingToast);
                    toast.success("Uploaded");
                }
            })
            .catch((err) => {
                toast.dismiss(loadingToast);
                toast.error(err.message || "Failed to upload banner");
            });
    };

    // Pick a file → open the round cropper. Reset the input value so re-picking the same file fires.
    const handleProfilePhotoUpload = (e) => {
        const img = e.target.files[0];
        if (img) setProfileToCrop(URL.createObjectURL(img));
        e.target.value = null;
    };

    // Cropper returns the cropped (square) photo as a File → upload that.
    const handleProfileCropped = (croppedFile) => {
        setProfileToCrop(null);
        const loadingToast = toast.loading("Uploading profile photo…");
        uploadImage(croppedFile)
            .then((url) => {
                if (url) {
                    setProfilePhoto(url);
                    toast.dismiss(loadingToast);
                    toast.success("Uploaded");
                }
            })
            .catch((err) => {
                toast.dismiss(loadingToast);
                toast.error(err.message || "Failed to upload profile photo");
            });
    };

    const handleDeleteVisual = () => {
        if (deleteTarget === "banner") {
            setBanner("");
        } else if (deleteTarget === "profile_photo") {
            setProfilePhoto("");
        }
        setDeleteTarget(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            return toast.error("Publication title is required");
        }

        setLoading(true);

        try {
            const { data } = await api.post("/publication/update", {
                publication_id: pubId,
                title: title.trim(),
                description: description.trim(),
                banner,
                profile_photo: profilePhoto,
                tags,
                social_links
            });

            // Drop the cached publication before navigating, otherwise the detail
            // page serves its stale copy and the edit looks like it never saved.
            // The slug can change with the title, so clear the old key too.
            const newSlug = data.publication.slug;
            queryClient.invalidateQueries({ queryKey: queryKeys.publications.detail(slug) });
            if (newSlug !== slug) {
                queryClient.invalidateQueries({ queryKey: queryKeys.publications.detail(newSlug) });
            }

            toast.success("Publication updated");
            navigate(`/publication/${newSlug}`);
        } catch (err) {
            toast.error(err.response?.data?.error || "Failed to update publication");
        } finally {
            setLoading(false);
        }
    };

    if (!access_token) {
        navigate("/signin");
        return null;
    }

    if (pageLoading) {
        return <Loader />;
    }

    return (
        <AnimationWrapper>
            <div className="create-pub">
                <ConfirmModal 
                    isOpen={deleteTarget !== null}
                    title="Remove Image"
                    message={`Are you sure you want to remove the ${deleteTarget === 'banner' ? 'banner' : 'profile photo'}?`}
                    confirmLabel="Remove"
                    variant="danger"
                    onConfirm={handleDeleteVisual}
                    onCancel={() => setDeleteTarget(null)}
                />
                <h1 className="create-pub__title">
                    <Icon name="edit" className="create-pub__title-icon" />
                    Edit Publication
                </h1>
                <p className="create-pub__subtitle">
                    Update the details of your publication below.
                </p>

                <form onSubmit={handleSubmit} className="create-pub__form">
                    {/* Banner and Profile Photo */}
                    <div className="create-pub__field">
                        <label className="create-pub__label">Publication Visuals</label>
                        <div className="relative mb-16">
                            {/* Banner Upload */}
                            <div className="relative aspect-[4/1] bg-grey overflow-hidden rounded-xl border-2 border-dashed border-border">
                                <label htmlFor="uploadBanner" className="absolute inset-0 z-10 cursor-pointer group hover:opacity-90 transition-opacity">
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
                                {banner && (
                                    <button
                                        type="button"
                                        className="absolute top-4 right-4 z-20 w-10 h-10 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setDeleteTarget("banner");
                                        }}
                                        title="Delete Banner"
                                    >
                                        <Icon name="delete" />
                                    </button>
                                )}
                            </div>

                            {/* Profile Photo Upload */}
                            <div className="absolute -bottom-10 left-8 z-20">
                                <div className="w-24 h-24 rounded-full bg-white border-4 border-white shadow-md overflow-hidden relative bg-grey">
                                    <label htmlFor="uploadProfilePhoto" className="absolute inset-0 z-10 cursor-pointer flex items-center justify-center bg-grey group hover:opacity-90 transition-opacity">
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
                                {/* Small always-visible badge instead of a full-cover overlay, so the
                                    photo itself stays clickable for re-upload (and touch users, who
                                    have no hover, don't tap an invisible delete button). */}
                                {profilePhoto && (
                                    <button
                                        type="button"
                                        className="absolute -top-1 -right-1 z-30 w-7 h-7 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center backdrop-blur-sm transition-colors"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setDeleteTarget("profile_photo");
                                        }}
                                        title="Delete Profile Photo"
                                    >
                                        <Icon name="delete" className="text-sm" />
                                    </button>
                                )}
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
                            {Object.keys(social_links).map((key, i) => {
                                // Skip Mongoose internal keys if they somehow appear
                                if (key === '_id' || key === '__v') return null;
                                return (
                                <div key={i} className="flex items-center bg-grey rounded-md px-4 py-2 border border-grey focus-within:border-black/20">
                                    <Icon name={key === 'website' ? 'language' : 'link'} className="text-xl text-dark-grey mr-3" />
                                    <input 
                                        type="text" 
                                        placeholder={`https://${key}.com/...`}
                                        className="bg-transparent border-none outline-none w-full placeholder-dark-grey/50"
                                        value={social_links[key] || ""}
                                        onChange={(e) => setSocialLinks({ ...social_links, [key]: e.target.value })}
                                    />
                                </div>
                            )})}
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="create-pub__submit"
                        disabled={loading || !title.trim()}
                    >
                        {loading ? "Updating..." : "Update Publication"}
                    </button>
                </form>
            </div>

            {bannerToCrop && (
                <ImageCropperModal
                    imageSrc={bannerToCrop}
                    aspect={BANNER_ASPECT}
                    cropShape="rect"
                    title="Crop banner"
                    onComplete={handleBannerCropped}
                    onCancel={() => setBannerToCrop(null)}
                />
            )}

            {profileToCrop && (
                <ImageCropperModal
                    imageSrc={profileToCrop}
                    title="Crop photo"
                    onComplete={handleProfileCropped}
                    onCancel={() => setProfileToCrop(null)}
                />
            )}
        </AnimationWrapper>
    );
};

export default EditPublicationPage;
