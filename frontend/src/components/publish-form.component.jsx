import toast from "react-hot-toast";
import AnimationWrapper from "../common/page-animation";
import { useContext, useEffect, useState } from "react";
import { EditorContext } from "../pages/editor.pages";
import Tag from "./tags.component";
import Icon from "./Icon";
import SaveStatus from "./editor/SaveStatus";
import api from "../common/api";
import { UserContext } from "../App";
import { useNavigate, useParams } from "react-router-dom";
import PublishSteps from "./publish-steps.component";
import PreviewButton from "./preview/PreviewButton";

const PublishForm = () => {

    let CharacterLimit = 200;
    let tagLimit = 10;

    let { blog_id } = useParams();
    
    let { blog, blog: { banner, title, tags, des, content }, setEditorState, setBlog, textEditor, saveStatus, savedAt, clearLocalDraft } = useContext(EditorContext);

    let { userAuth: { access_token } } = useContext(UserContext);

    let navigate = useNavigate();

    // A published post can't be moved back to a draft (the server rejects it too), so "Save as draft"
    // is hidden when editing one. blog.draft is present when editing an existing post (loaded via
    // get-blog) and undefined for a brand-new post — matching the editor's own isEditingPublishedPost.
    const isEditingPublishedPost = Boolean(blog_id && blog?.draft === false);

    const [publications, setPublications] = useState([]);
    const [selectedPub, setSelectedPub] = useState("");

    // Fetch user's publications on mount
    useEffect(() => {
        if (access_token) {
            api.post("/my-publications")
            .then(({ data }) => {
                setPublications(data.publications || []);
                // If editing and blog already has a publication, pre-select it
                if (blog.publication) {
                    setSelectedPub(blog.publication);
                }
            })
            .catch(() => {});
        }
    }, [access_token]);

    const handleCloseEvent = () => {
        setEditorState("editor");
    }

    const handleBlogTitleChange = (e) => {
        let input = e.target;

        setBlog({ ...blog, title: input.value })
    }

    const handleBlogDesChange = (e) => {
        let input = e.target;

        setBlog({ ...blog, des: input.value })
    }

    const handleDesKeyDown = (e) => {
        if(e.keyCode == 13){
            e.preventDefault();
        }
    }

    const handleTagkeyDown = (e) => {
        if(e.keyCode == 13 || e.keyCode == 188){

            e.preventDefault();

            let tag = e.target.value;

            if(tags.length < tagLimit){
                if(!tags.includes(tag) && tag.length){
                    setBlog({ ...blog, tags: [ ...tags, tag ] })
                }
            }else {
                toast.error(`You can add up to ${tagLimit} hashtags`);
            }

            e.target.value = "";
        }
    }

    // Phase 2 → phase 3. Validate everything publishing needs, stash the latest editor content and the
    // chosen publication onto the shared blog (so phase 3 can publish without the now-unmounting editor),
    // then advance to the Scroll cover step where the actual "Publish" lives.
    const continueToScrollCover = () => {

        if(!title.length){
            return toast.error("Write blog title before publishing");
        }

        if(!des.length || des.length > CharacterLimit){
            return toast.error(`Write a description about your blog within ${CharacterLimit} characters to publish`);
        }

        if(!tags.length){
            return toast.error("Add at least 1 hashtag so readers can find your blog");
        }

        if(!banner.length){
            return toast.error("Upload a blog banner before publishing");
        }

        // Get latest content from Tiptap editor (fall back to the last synced content if the editor
        // instance is already tearing down).
        let finalContent = content;
        if (textEditor && typeof textEditor.getJSON === 'function') {
            try { finalContent = textEditor.getJSON(); } catch { /* use last synced content */ }
        }

        // Validate content exists
        const hasContent = finalContent?.type === 'doc'
            ? (finalContent.content && finalContent.content.length > 0 &&
               !(finalContent.content.length === 1 && finalContent.content[0].type === 'paragraph' && !finalContent.content[0].content))
            : (finalContent?.blocks && finalContent.blocks.length > 0);

        if (!hasContent) {
            return toast.error("Write something in your blog to publish it");
        }

        setBlog({ ...blog, content: finalContent, publication: selectedPub || null });
        setEditorState("scroll");
    }

    // Save everything entered here — including the description, tags and publication chosen on THIS
    // screen — as a draft. Drafts only require a title (the server relaxes des/banner/tags/content for
    // drafts), so nothing the user has filled in is lost and they can finish publishing later.
    const saveDraft = (e) => {

        if(e.target.className.includes("disable")){
            return;
        }

        if(!title.length){
            return toast.error("Write a blog title before saving as draft");
        }

        // Pull the latest body from the editor, same as publishing.
        let finalContent = content;
        if (textEditor && typeof textEditor.getJSON === 'function') {
            finalContent = textEditor.getJSON();
        }

        let loadingToast = toast.loading("Saving draft…");

        e.target.classList.add('disable');

        let blogObj = {
            title, banner, des, content: finalContent, tags, draft: true,
            publication: selectedPub || null
        }

        // `id: blog_id` updates the existing draft (or published-post-in-edit) in place; when it's a
        // brand-new post blog_id is undefined and the server creates a fresh draft — no duplicates.
        api.post("/create-blog", { ...blogObj, id: blog_id })
        .then(() => {
            e.target.classList.remove('disable');

            // Saved to the server — drop the local safety-net snapshot.
            clearLocalDraft?.();

            toast.dismiss(loadingToast);
            toast.success("Saved to drafts");

            setTimeout(() => {
                navigate("/dashboard/blogs?tab=draft");
            }, 500);
        })
        .catch((err) => {
            e.target.classList.remove('disable');
            toast.dismiss(loadingToast);

            // Same centralized-vs-call-site split as publishBlog (see comment above).
            const status = err?.response?.status;
            if (status && status < 500 && ![401, 413, 429].includes(status)) {
                toast.error(err.response.data?.error || "Something went wrong while saving. Please try again.");
            }
        })

    }

    return(
        <>
        {/* Top bar mirrors phase 1 (editor): a back arrow on the left, the step indicator and the primary
            actions on the right. "Continue" advances to the scroll-cover step (phase 3); "Save as draft"
            saves from here. Replaces the old absolute close (×) button and the bottom button row. */}
        <nav className="navbar">
            <button
                className="w-10 h-10 flex-none rounded-full bg-grey hover:bg-grey/80 flex items-center justify-center transition-colors"
                onClick={handleCloseEvent}
                aria-label="Back to editor"
            >
                <Icon name="arrow_back" />
            </button>

            <p className="max-md:hidden text-2xl text-black line-clamp-1 w-full font-medium">
                { title.length ? title : "New Blog" }
            </p>

            <div className="flex items-center gap-2 md:gap-4 ml-auto">
                <PreviewButton />
                <PublishSteps current={2} />
                <span className="hidden md:flex justify-end min-w-[108px]">
                    <SaveStatus status={saveStatus} savedAt={savedAt} />
                </span>
                <button className="btn-brand py-2 px-6"
                    onClick={continueToScrollCover}
                >
                    Continue
                </button>
                {!isEditingPublishedPost && (
                    <button className="btn-light py-2 flex items-center gap-2"
                        onClick={saveDraft}
                    >
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
            <section className="w-full min-h-screen grid items-center lg:grid-cols-2 py-16 lg:gap-4 px-4 sm:px-6">

                <div className="max-w-[550px] center mt-2">

                    <div className="w-full aspect-video rounded-radius-lg overflow-hidden bg-grey mt-4">
                        <img src={banner} alt="Blog banner" />
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-bold mt-4 leading-tight line-clamp-2">{ title }</h1>

                    <p className="font-merriweather line-clamp-2 text-xl leading-7 mt-4 text-dark-grey">{ des }</p>
                </div>

                <div className="border-border lg:border-l lg:pl-8">
                    <p className="text-dark-grey mb-2 mt-9 text-sm font-medium">Blog Title</p>
                    <input type="text" placeholder="Blog Title" defaultValue={title} className="input-box pl-4" onChange={handleBlogTitleChange}/>

                    <p className="text-dark-grey mb-2 mt-9 text-sm font-medium">Short description about your blog</p>
                    
                    <textarea
                        maxLength={CharacterLimit}
                        defaultValue={des}
                        className="h-40 resize-none leading-7 input-box pl-4"
                        onChange={handleBlogDesChange}
                        onKeyDown={handleDesKeyDown}
                    >
                    </textarea>

                    <p className="mt-1 text-dark-grey text-sm text-right">{ CharacterLimit - des.length } characters left</p>

                    <p className="text-dark-grey mb-1 mt-9 text-sm font-medium">Hashtags — help readers discover your blog</p>
                    <p className="text-dark-grey text-xs mb-2 leading-relaxed">
                        Type a topic and press <b className="font-semibold">Enter</b> to add it. No need to type “#” — it’s added automatically.
                    </p>

                    <div className="relative input-box pl-2 py-2 pb-4">
                        <input type="text" placeholder="Add a topic, then press Enter" className="sticky input-box bg-surface top-0 left-0 pl-4 mb-3 focus:bg-surface"
                        onKeyDown={handleTagkeyDown}
                        />

                        { 
                            tags.map((tag, i) => {
                                return <Tag tag={tag} tagIndex={i} key={i}/>
                            })
                        }
                    </div>

                    <p className="mt-1 mb-6 text-dark-grey text-sm text-right">{ tagLimit - tags.length } hashtags left</p>

                    {/* Publication Selector */}
                    {publications.length > 0 && (
                        <div className="publish-pub-selector">
                            <p className="text-dark-grey mb-2 text-sm font-medium">
                                <Icon name="import_contacts" className="text-base align-middle mr-1" />
                                Add to Publication (optional)
                            </p>
                            <select
                                className="input-box pl-4"
                                value={selectedPub}
                                onChange={(e) => setSelectedPub(e.target.value)}
                            >
                                <option value="">None — standalone blog</option>
                                {publications.map(pub => (
                                    <option key={pub._id} value={pub._id}>
                                        {pub.title}
                                    </option>
                                ))}
                            </select>
                            <p className="mt-1 text-dark-grey text-xs">This blog will appear in the selected publication and be visible to its subscribers.</p>
                        </div>
                    )}

                </div>

            </section>
        </AnimationWrapper>
        </>
    )
}

export default PublishForm;