import { Link, useNavigate, useParams } from "react-router-dom";
import darkLogo from "../imgs/logo-dark.png";
import lightLogo from "../imgs/logo-light.png";
import AnimationWrapper from "../common/page-animation";
import lightBanner from "../imgs/blog banner light.png";
import darkBanner from "../imgs/blog banner dark.png";
import { uploadImage } from "../common/aws";
import { useContext, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import { EditorContext } from "../pages/editor.pages";
import TiptapEditor from "./editor/TiptapEditor";
import api from "../common/api";
import { ThemeContext, UserContext } from "../App";
import Icon from "./Icon";

const BlogEditor = () => {

    let { blog, setBlog, setTextEditor, setEditorState } = useContext(EditorContext);
    let { title, banner, content, tags, des } = blog;

    let { userAuth: { access_token } } = useContext(UserContext);
    let { theme } = useContext(ThemeContext);
    let { blog_id } = useParams();

    let navigate = useNavigate();

    // Ref to hold the Tiptap editor instance
    const editorRef = useRef(null);

    const handleEditorReady = useCallback((editor) => {
        editorRef.current = editor;
        setTextEditor(editor);
    }, [setTextEditor]);

    const handleEditorUpdate = useCallback((json) => {
        setBlog(prev => ({ ...prev, content: json }));
    }, [setBlog]);

    const handleBanner = (e) => {
        let img = e.target.files[0];

        if(img){
            
            if (!img.type.startsWith('image/')) {
                return toast.error("Please select an image file (.png, .jpg, .jpeg)");
            }

            let loadingToast = toast.loading("Uploading....");

            uploadImage(img).then((url) => {
                if(url){

                    toast.dismiss(loadingToast);
                    toast.success("Uploaded 👍");

                    setBlog({ ...blog, banner: url })
                }
            })
            .catch(err => {
                toast.dismiss(loadingToast);
                console.error("Banner upload error:", err);
                toast.error(err?.response?.data?.error || err.message || "Upload failed");
            })
        }
        
    }

    const handleTitleKeyDown = (e) => {
        if(e.keyCode == 13){
            e.preventDefault();
        }
    }

    const handleTitleChange = (e) => {
        let input = e.target;

        input.style.height = 'auto';
        input.style.height = input.scrollHeight + "px";

        setBlog({ ...blog, title: input.value })
    }

    const handleImgError = (e) => {
        let img = e.target;

        img.src = theme === "light" ? lightBanner : darkBanner;
    }

    const handlePublishEvent = () => {

        if(!banner.length){
            return toast.error("Upload a blog banner to publish it");
        }

        if(!title.length){
            return toast.error("Write blog title to publish it");
        }

        // Get content from the Tiptap editor
        const editor = editorRef.current;
        if (editor) {
            const data = editor.getJSON();
            // Check if there's actual content (more than just an empty paragraph)
            const hasContent = data.content && data.content.length > 0 && 
                !(data.content.length === 1 && data.content[0].type === 'paragraph' && !data.content[0].content);
            
            if (hasContent) {
                setBlog({ ...blog, content: data });
                setEditorState("publish");
            } else {
                return toast.error("Write something in your blog to publish it");
            }
        }
    }

    const handleSaveDraft = (e) => {

        if(e.target.className.includes("disable")){
            return;
        }
        
        if(!title.length){
            return toast.error("Write blog title before saving it as a draft");
        }
        
        let loadingToast = toast.loading("Saving Draft....");
        
        e.target.classList.add('disable');
        
        const editor = editorRef.current;
        const editorContent = editor ? editor.getJSON() : { type: 'doc', content: [] };

        let blogObj = {
            title, banner, des, content: editorContent, tags, draft: true
        }
        
        api.post("/create-blog", { ...blogObj, id: blog_id })
        .then(() => {
    
            e.target.classList.remove('disable');
                    
            toast.dismiss(loadingToast);
            toast.success("Saved 👍");
        
            setTimeout(() => {
                navigate("/dashboard/blogs?tab=draft");
            }, 500);
        })
        .catch(( { response } ) => {
            e.target.classList.remove('disable');
            toast.dismiss(loadingToast);
        
            return toast.error(response.data.error);
        
        })

    }

    // Prepare initial content for the editor
    const getInitialContent = () => {
        if (!content || (Array.isArray(content) && content.length === 0)) {
            return null; // New post — empty editor
        }
        const normalized = Array.isArray(content) ? content[0] : content;
        // Tiptap format
        if (normalized?.type === 'doc') {
            return normalized;
        }
        // EditorJS format — can't load in Tiptap
        if (normalized?.blocks) {
            toast.error("This post uses a legacy editor format. Content has been loaded as read-only. Please recreate if you need to edit.", { duration: 5000 });
            return null;
        }
        return null;
    };

    return(
        <>
            <nav className="navbar">
                <Link to="/" className="flex-none w-16" >
                    <img src={ theme === "light" ? darkLogo : lightLogo } alt="Kalamio logo" />
                </Link>
                <p className="max-md:hidden text-black line-clamp-1 w-full font-medium">
                    { title.length ? title : "New Blog" }
                </p>

                <div className="flex gap-4 ml-auto">
                    <button className="btn-brand py-2 px-6"
                        onClick={handlePublishEvent}
                    >
                        Publish
                    </button>
                    <button className="btn-light py-2"
                        onClick={handleSaveDraft}
                    >
                        Save Draft
                    </button>
                </div>
            </nav>

            <AnimationWrapper>
                <section>
                    <div className="mx-auto max-w-[900px] w-full">
                        <div className="relative aspect-video hover:opacity-80 bg-surface border-2 border-dashed border-border rounded-radius-lg overflow-hidden cursor-pointer group transition-all hover:border-brand/40">
                            <label htmlFor="uploadbanner" className="cursor-pointer">
                                <img
                                    src={banner}
                                    className="z-20"
                                    onError={handleImgError}
                                    />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                                    <div className="bg-surface/90 backdrop-blur-sm rounded-full py-2 px-5 flex items-center gap-2 shadow-md">
                                        <Icon name="add_photo_alternate" className="text-xl text-dark-grey" />
                                        <span className="text-sm font-medium">Change Cover</span>
                                    </div>
                                </div>
                                <input
                                    id="uploadbanner"
                                    type="file"
                                    accept=".png, .jpg, .jpeg"
                                    hidden
                                    onChange={handleBanner}
                                />
                            </label>
                            
                        </div>

                        <textarea
                            defaultValue={title}
                            placeholder="Blog Title"
                            className="text-4xl font-bold w-full outline-none resize-none mt-10 leading-tight placeholder:opacity-30 bg-transparent border-none focus:ring-0 focus:outline-none overflow-hidden p-0"
                            style={{ minHeight: '52px' }}
                            onKeyDown={handleTitleKeyDown}
                            onChange={handleTitleChange}
                            ref={(el) => {
                                if (el) {
                                    el.style.height = 'auto';
                                    el.style.height = el.scrollHeight + 'px';
                                }
                            }}
                        ></textarea>

                        <hr className="w-full opacity-10 my-5" />

                        <TiptapEditor
                            content={getInitialContent()}
                            onUpdate={handleEditorUpdate}
                            onEditorReady={handleEditorReady}
                        />

                    </div>
                </section>
            </AnimationWrapper>
        </>
    )
}

export default BlogEditor;