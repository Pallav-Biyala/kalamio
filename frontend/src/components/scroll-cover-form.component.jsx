import toast from "react-hot-toast";
import AnimationWrapper from "../common/page-animation";
import { useContext, useRef, useState } from "react";
import { EditorContext } from "../pages/editor.pages";
import { useNavigate, useParams } from "react-router-dom";
import Icon from "./Icon";
import SaveStatus from "./editor/SaveStatus";
import ImageCropperModal from "./image-cropper.component";
import PublishSteps from "./publish-steps.component";
import PreviewButton from "./preview/PreviewButton";
import api from "../common/api";
import { uploadImage } from "../common/aws";
import { cdnUrl } from "../common/cdn";

// The Reads / "scroll" feed is a full-screen portrait card, so the cover is cropped 9:16.
const SCROLL_ASPECT = 9 / 16;

/**
 * Publish phase 3 — the "Scroll cover".
 *
 * The vertical Reads feed shows each article as a full-screen portrait reel. By default it reuses the
 * (landscape) banner, arbitrarily centre-cropped. This step lets the author crop the banner to the
 * 9:16 shape — or upload a different photo — so the reel is framed on purpose. The result is stored in
 * `blog.scroll_image`; an empty value falls back to the banner on the reads page. The actual Publish
 * (and Save as draft, incl. the scroll cover) lives here, at the end of the wizard.
 */
const ScrollCoverForm = () => {
    const { blog_id } = useParams();
    const { blog, setBlog, setEditorState, clearLocalDraft, saveStatus, savedAt } = useContext(EditorContext);
    const navigate = useNavigate();

    const { title, banner, scroll_image, des } = blog;
    const isEditingPublishedPost = Boolean(blog_id && blog?.draft === false);

    const [imageToCrop, setImageToCrop] = useState(null); // source being cropped (S3 URL or a new blob)
    const [busy, setBusy] = useState(false);
    const fileInputRef = useRef(null);

    // What the reels feed will actually show: the dedicated scroll image if set, else the banner.
    const coverSrc = scroll_image || banner;

    const handleCropped = (file) => {
        setImageToCrop(null);
        const t = toast.loading("Saving scroll cover…");
        uploadImage(file)
            .then((url) => {
                if (url) {
                    setBlog((prev) => ({ ...prev, scroll_image: url }));
                    toast.dismiss(t);
                    toast.success("Scroll cover updated");
                }
            })
            .catch((err) => { toast.dismiss(t); toast.error(err?.message || "Upload failed"); });
    };

    const handleFilePicked = (e) => {
        const img = e.target.files?.[0];
        if (img) {
            if (!img.type.startsWith("image/")) toast.error("Please select an image file");
            else setImageToCrop(URL.createObjectURL(img));
        }
        e.target.value = "";
    };

    const resetToBanner = () => setBlog((prev) => ({ ...prev, scroll_image: "" }));

    // Shared create-blog payload (publish OR draft). All fields come from the shared blog, which phase
    // 2 already populated with the latest content + chosen publication.
    const buildPayload = (draft) => ({
        title: blog.title, banner: blog.banner, scroll_image: blog.scroll_image || "",
        des: blog.des, content: blog.content, tags: blog.tags, draft,
        publication: blog.publication || null, id: blog_id,
    });

    const submit = (draft) => {
        if (busy) return;
        if (draft && !blog.title?.length) return toast.error("Write a blog title before saving as draft");
        setBusy(true);
        const t = toast.loading(draft ? "Saving draft…" : "Publishing…");
        api.post("/create-blog", buildPayload(draft))
            .then(() => {
                clearLocalDraft?.();
                toast.dismiss(t);
                toast.success(draft ? "Saved to drafts" : "Published");
                setTimeout(() => navigate(draft ? "/dashboard/blogs?tab=draft" : "/dashboard/blogs"), 500);
            })
            .catch((err) => {
                setBusy(false);
                toast.dismiss(t);
                // 413/429/5xx/offline are surfaced centrally by the api interceptor; only show specific 4xx here.
                const status = err?.response?.status;
                if (status && status < 500 && ![401, 413, 429].includes(status)) {
                    toast.error(err.response?.data?.error || `Something went wrong while ${draft ? "saving" : "publishing"}. Please try again.`);
                }
            });
    };

    return (
        <>
        {/* Top bar mirrors phases 1 & 2: a back arrow on the left, the step indicator and the primary
            actions on the right. "Publish" (and "Save as draft") submit from here — the crop / upload
            controls for the cover itself live in the right column below. */}
        <nav className="navbar">
            <button
                className="w-10 h-10 flex-none rounded-full bg-grey hover:bg-grey/80 flex items-center justify-center transition-colors"
                onClick={() => setEditorState("publish")}
                aria-label="Back to publish details"
            >
                <Icon name="arrow_back" />
            </button>

            <p className="max-md:hidden text-2xl text-black line-clamp-1 w-full font-medium">
                { title || "New Blog" }
            </p>

            <div className="flex items-center gap-2 md:gap-4 ml-auto">
                <PreviewButton />
                <PublishSteps current={3} />
                <span className="hidden md:flex justify-end min-w-[108px]">
                    <SaveStatus status={saveStatus} savedAt={savedAt} />
                </span>
                <button className="btn-brand py-2 px-6" onClick={() => submit(false)} disabled={busy}>
                    {busy ? "Publishing…" : "Publish"}
                </button>
                {!isEditingPublishedPost && (
                    <button className="btn-light py-2 flex items-center gap-2" onClick={() => submit(true)} disabled={busy}>
                        <Icon name="save" className="text-lg" />
                        Save as draft
                    </button>
                )}
            </div>
        </nav>

        {/* Autosave status — MOBILE only. It's hidden in the nav on phones (no room beside the
            buttons), so it gets its own line just below the bar. */}
        <div className="md:hidden flex justify-end px-4 pt-2">
            <SaveStatus status={saveStatus} savedAt={savedAt} />
        </div>

        <AnimationWrapper>
            <section className="w-full min-h-screen grid items-center lg:grid-cols-2 py-16 lg:gap-8 px-4 sm:px-6">

                {/* ── Portrait reel preview ── */}
                <div className="flex justify-center">
                    <div className="scroll-cover-preview">
                        {coverSrc ? (
                            <img src={cdnUrl(coverSrc)} alt="Scroll cover" className="scroll-cover-preview__img" />
                        ) : (
                            <div className="scroll-cover-preview__empty">
                                <Icon name="image" className="text-4xl text-dark-grey/40" />
                                <span className="text-dark-grey text-sm mt-2">No cover yet</span>
                            </div>
                        )}
                        <div className="scroll-cover-preview__scrim" />
                        <div className="scroll-cover-preview__meta">
                            <h3 className="scroll-cover-preview__title">{title || "Your article title"}</h3>
                            {des && <p className="scroll-cover-preview__des">{des}</p>}
                        </div>
                    </div>
                </div>

                {/* ── Controls ── */}
                <div className="lg:border-l border-border lg:pl-8 max-w-[520px] mt-8 lg:mt-0">
                    <h1 className="text-2xl sm:text-3xl font-bold leading-tight">Scroll cover</h1>
                    <p className="text-dark-grey mt-3 leading-relaxed">
                        This tall cover shows on the vertical <b className="text-black font-semibold">Article Scroll</b> feed —
                        cropped to 9:16. Crop your banner to frame it, or use a different photo.
                        {scroll_image ? "" : " Right now it falls back to your banner."}
                    </p>

                    <div className="flex flex-wrap gap-3 mt-6">
                        <button
                            type="button"
                            className="btn-light px-5 flex items-center gap-2"
                            onClick={() => coverSrc && setImageToCrop(coverSrc)}
                            disabled={!coverSrc}
                        >
                            <Icon name="crop" className="text-lg" />
                            {scroll_image ? "Re-crop cover" : "Crop banner for scroll"}
                        </button>
                        <button
                            type="button"
                            className="btn-light px-5 flex items-center gap-2"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Icon name="add_photo_alternate" className="text-lg" />
                            Upload a different photo
                        </button>
                        {scroll_image && (
                            <button type="button" className="btn-light px-5 flex items-center gap-2" onClick={resetToBanner}>
                                <Icon name="delete" className="text-lg" />
                                Reset to banner
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFilePicked} />
                    </div>

                </div>
            </section>

            {imageToCrop && (
                <ImageCropperModal
                    imageSrc={imageToCrop}
                    aspect={SCROLL_ASPECT}
                    cropShape="rect"
                    title="Crop scroll cover"
                    onComplete={handleCropped}
                    onCancel={() => setImageToCrop(null)}
                />
            )}
        </AnimationWrapper>
        </>
    );
};

export default ScrollCoverForm;
