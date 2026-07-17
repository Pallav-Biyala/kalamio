import { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import usePageTitle from "../common/usePageTitle";
import { UserContext } from "../App";
import { propagateProfileUpdate } from "../common/propagateProfile";
import api from "../common/api";
import { profileDataStructure } from "./profile.page";
import AnimationWrapper from "../common/page-animation";
import Loader from "../components/loader.component";
import toast from "react-hot-toast";
import InputBox from "../components/input.component";
import { uploadImage } from "../common/aws";
import { storeInSession } from "../common/session";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import ImageCropperModal from "../components/image-cropper.component";

// ─── Helper: is this a real uploaded photo (not an avatar: initials string)?
const isRealPhoto = (src) => src && !src.startsWith("avatar:");

const EditProfile = () => {

    usePageTitle('Edit Profile');

    const navigate = useNavigate();
    const queryClient = useQueryClient();

    let { userAuth, userAuth: { access_token }, setUserAuth } = useContext(UserContext);

    let bioLimit = 150;

    let editProfileForm = useRef();
    let fileInputRef = useRef();
    
    const [ profile, setProfile ] = useState(profileDataStructure);
    const [ loading, setLoading ] = useState(true);
    const [ charactersLeft, setCharactersLeft ] = useState(bioLimit);
    const [ updatedProfileImg, setUpdatedProfileImg ] = useState(null);
    const [ previewImgUrl, setPreviewImgUrl ] = useState(null);
    const [ cropImageSrc, setCropImageSrc ] = useState(null);
    const [ photoMenuOpen, setPhotoMenuOpen ] = useState(false);
    const [ uploading, setUploading ] = useState(false);

    let { personal_info: { fullname, username: profile_username, profile_img, email, bio }, social_links } = profile;

    // The currently visible photo: preview (pending crop) > server photo
    const displayImgSrc = previewImgUrl || profile_img;
    const hasRealPhoto = isRealPhoto(profile_img);
    const hasPendingCrop = updatedProfileImg !== null;

    useEffect(() => {

        if(access_token){
            api.post("/get-profile", { username: userAuth.username })
            .then(({data}) => {
                setProfile(data);
                setLoading(false);
            })
            .catch(err => {
            })
        }

    }, [access_token])

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setPhotoMenuOpen(false);
        if (photoMenuOpen) {
            document.addEventListener("click", handleClickOutside);
            return () => document.removeEventListener("click", handleClickOutside);
        }
    }, [photoMenuOpen]);

    const handleCharacterChange = (e) => {
        setCharactersLeft(bioLimit - e.target.value.length)
    }

    // ── Photo workflow ──────────────────────────────────────────────

    const openFilePicker = () => {
        fileInputRef.current.click();
    };

    const handleFileSelected = (e) => {
        let img = e.target.files[0];
        if(img){
            setCropImageSrc(URL.createObjectURL(img));
        }
        e.target.value = null;
    }

    const handleEditCurrentPhoto = () => {
        // Open the cropper on the existing server photo directly — CSP img-src allows S3/Google
        // hosts, so it displays fine. The cropper handles the CORS-safe read for canvas export.
        setCropImageSrc(profile_img);
    };

    const handleCropComplete = (croppedFile) => {
        setUpdatedProfileImg(croppedFile);
        setPreviewImgUrl(URL.createObjectURL(croppedFile));
        setCropImageSrc(null);
    };

    const handleCropCancel = () => {
        setCropImageSrc(null);
    };

    const handleSavePhoto = (e) => {
        e.preventDefault();

        if(!updatedProfileImg) return;
        
        setUploading(true);
        let loadingToast = toast.loading("Saving photo…");

        uploadImage(updatedProfileImg)
        .then(url => {
            
            if(url){
                api.post("/update-profile-img", { url })
                .then(({ data }) => {
                    let newUserAuth = { ...userAuth, profile_img: data.profile_img }

                    storeInSession("user", JSON.stringify(newUserAuth));
                    setUserAuth(newUserAuth);

                    // Update local profile state so the page reflects the new image
                    setProfile(prev => ({
                        ...prev,
                        personal_info: { ...prev.personal_info, profile_img: data.profile_img }
                    }));

                    // Propagate the new photo to every cached avatar across the app (no refresh)
                    propagateProfileUpdate(queryClient, userAuth._id, { profile_img: data.profile_img });

                    setUpdatedProfileImg(null);
                    setPreviewImgUrl(null);
                    toast.dismiss(loadingToast);
                    setUploading(false);
                    toast.success("Photo saved");
                })
                .catch(({response}) => {
                    toast.dismiss(loadingToast);
                    setUploading(false);
                    toast.error(response?.data?.error || "Upload failed");
                })
            }

        })
        .catch(err => {
            toast.dismiss(loadingToast);
            setUploading(false);
            toast.error("Upload failed");
        })

    }

    const handleRemovePhoto = (e) => {
        e.preventDefault();

        let loadingToast = toast.loading("Removing photo…");
        setUploading(true);

        api.post("/update-profile-img", { url: "" })
        .then(({ data }) => {
            let newUserAuth = { ...userAuth, profile_img: data.profile_img }

            storeInSession("user", JSON.stringify(newUserAuth));
            setUserAuth(newUserAuth);

            setProfile(prev => ({
                ...prev,
                personal_info: { ...prev.personal_info, profile_img: data.profile_img }
            }));

            // Propagate the removal to every cached avatar across the app (no refresh)
            propagateProfileUpdate(queryClient, userAuth._id, { profile_img: data.profile_img });

            setUpdatedProfileImg(null);
            setPreviewImgUrl(null);
            toast.dismiss(loadingToast);
            setUploading(false);
            toast.success("Photo removed");
        })
        .catch(({response}) => {
            toast.dismiss(loadingToast);
            setUploading(false);
            toast.error(response?.data?.error || "Removal failed");
        })
    }

    const handleDiscardCrop = (e) => {
        e.preventDefault();
        setUpdatedProfileImg(null);
        setPreviewImgUrl(null);
    };

    // ── Profile form submit ─────────────────────────────────────────

    const handleSubmit = (e) => {
        e.preventDefault();

        let form = new FormData(editProfileForm.current);
        let formData = { };

        for(let [key, value] of form.entries()){
            formData[key] = value;
        }

        let { username, bio, youtube, facebook, twitter, github, instagram, website } = formData;

        if(username.length < 3){
            return toast.error("Username should be at least 3 letters long");
        }
        if(bio.length > bioLimit){
            return toast.error(`Bio should not be more than ${bioLimit} characters`)
        }

        let loadingToast = toast.loading("Updating…");
        e.target.setAttribute("disabled", true);

        api.post("/update-profile", {
            username, bio,
            social_links: { youtube, facebook, twitter, github, instagram, website }
        })
        .then(({ data }) => {

            const usernameChanged = userAuth.username != data.username;

            if(usernameChanged){

                let newUserAuth = { ...userAuth, username: data.username };

                storeInSession("user", JSON.stringify(newUserAuth));
                setUserAuth(newUserAuth);

            }

            // Reconcile cached feeds/comments/profile; instantly patch a changed username everywhere.
            propagateProfileUpdate(queryClient, userAuth._id, usernameChanged ? { username: data.username } : null);

            toast.dismiss(loadingToast);
            e.target.removeAttribute("disabled");
            toast.success("Profile updated");
            
            // Redirect to the user's profile page
            setTimeout(() => {
                navigate(`/user/${data.username}`);
            }, 1000); // Slight delay so they can see the success toast

        })
        .catch(({ response }) => {
            toast.dismiss(loadingToast);
            e.target.removeAttribute("disabled");
            toast.error(response.data.error);
        })

    }

    return (
        <AnimationWrapper>
            {/* ── Cropper modal ──────────────────────── */}
            {cropImageSrc && (
                <ImageCropperModal
                    imageSrc={cropImageSrc}
                    onComplete={handleCropComplete}
                    onCancel={handleCropCancel}
                />
            )}
            {
                loading ? <Loader /> : 
                <form ref={editProfileForm}>


                    <h1 className="max-md:hidden">Edit Profile</h1>

                    <div className="flex flex-col lg:flex-row items-start py-10 gap-8 lg:gap-10">
                        
                        {/* ── Photo section ──────────────────── */}
                        <div className="max-lg:center mb-5 w-48 flex-shrink-0">

                            {/* Avatar with overlay */}
                            <div className="relative w-48 h-48 mx-auto" style={{ aspectRatio: '1/1' }}>
                                <div className="w-full h-full rounded-full overflow-hidden bg-grey">
                                    {previewImgUrl ? (
                                        <img src={previewImgUrl} alt="Profile" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Avatar src={profile_img} alt="Profile" size={192} />
                                        </div>
                                    )}
                                </div>

                                {/* Pencil badge — opens context menu */}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setPhotoMenuOpen(!photoMenuOpen); }}
                                    className="absolute bottom-1 right-1 w-10 h-10 bg-black rounded-full flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:bg-black/80 transition-colors z-10"
                                >
                                    <Icon name="edit" className="text-white text-lg" />
                                </button>

                                {/* ── Context menu ── */}
                                {photoMenuOpen && (
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2 top-full mt-2 bg-white rounded-xl shadow-xl border border-grey/40 py-1.5 z-30 min-w-[180px] overflow-hidden"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            type="button"
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-grey/50 transition-colors text-left"
                                            onClick={() => { setPhotoMenuOpen(false); openFilePicker(); }}
                                        >
                                            <Icon name="upload" className="text-lg text-dark-grey" />
                                            Upload new photo
                                        </button>

                                        {hasRealPhoto && (
                                            <button
                                                type="button"
                                                className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-grey/50 transition-colors text-left"
                                                onClick={() => { setPhotoMenuOpen(false); handleEditCurrentPhoto(); }}
                                            >
                                                <Icon name="crop" className="text-lg text-dark-grey" />
                                                Edit current photo
                                            </button>
                                        )}

                                        {hasRealPhoto && (
                                            <>
                                                <div className="border-t border-grey/40 my-1" />
                                                <button
                                                    type="button"
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-red/5 transition-colors text-left text-red"
                                                    onClick={(e) => { setPhotoMenuOpen(false); handleRemovePhoto(e); }}
                                                >
                                                    <Icon name="delete" className="text-lg" />
                                                    Remove photo
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Hidden file input */}
                            <input
                                type="file"
                                ref={fileInputRef}
                                accept=".jpeg, .png, .jpg"
                                hidden
                                onChange={handleFileSelected}
                            />

                            {/* Pending-crop action bar */}
                            {hasPendingCrop && (
                                <div className="flex gap-3 mt-4 w-full">
                                    <button
                                        type="button"
                                        className="btn-light flex-1 !py-2 !text-sm"
                                        onClick={handleDiscardCrop}
                                    >
                                        Discard
                                    </button>
                                    <button
                                        type="button"
                                        className="btn-dark flex-1 !py-2 !text-sm"
                                        onClick={handleSavePhoto}
                                        disabled={uploading}
                                    >
                                        {uploading ? "Saving…" : "Save"}
                                    </button>
                                </div>
                            )}

                        </div>

                        <div className="w-full">

                            <div className="grid grid-cols-1 md:grid-cols-2 md:gap-5">
                                <div>
                                    <InputBox name="fullname" type="text" value={fullname} placeholder="Full Name" disable={true} icon="person" />  
                                </div>
                                <div>
                                    <InputBox name="email" type="email" value={email} placeholder="Email" disable={true} icon="mail" />  
                                </div>
                            </div>

                            <InputBox type="text" name="username" value={profile_username} placeholder="Username" icon="alternate_email" />

                            <p className="text-dark-grey -mt-3">Username will use to search user and will be visible to all users</p>

                            <textarea name="bio" maxLength={bioLimit} defaultValue={bio} className="input-box h-64 lg:h-40 resize-none leading-7 mt-5 pl-5 placeholder:text-dark-grey" placeholder="Bio" onChange={handleCharacterChange}></textarea>

                            <p className="mt-1 text-dark-grey text-sm">{ charactersLeft } CharactersLeft</p>

                            <p className="my-6 text-dark-grey">Add your social handles below</p>

                            <div className="md:grid md:grid-cols-2 gap-x-6">

                                {

                                    Object.keys(social_links).map((key, i) => {

                                        let link = social_links[key];
                                        let coustomPlaceholder = `https://${key}.com/username`

                                        const socialIconMap = { youtube: 'smart_display', facebook: 'group', twitter: 'tag', github: 'code', instagram: 'photo_camera', website: 'language' };

                                        return <InputBox key={key} name={key} type="text" value={link} placeholder={coustomPlaceholder} icon={socialIconMap[key] || 'link'} className="placeholder:text-dark-grey placeholder:opacity-70" />

                                    })

                                }

                            </div>

                            <button className="btn-dark w-auto px-10" type="submit" onClick={handleSubmit}>Update</button>

                        </div>
                    </div>
                </form>
            }

        </AnimationWrapper>
    )
}

export default EditProfile;