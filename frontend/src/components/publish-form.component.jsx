import toast from "react-hot-toast";
import AnimationWrapper from "../common/page-animation";
import { useContext, useEffect, useState } from "react";
import { EditorContext } from "../pages/editor.pages";
import Tag from "./tags.component";
import Icon from "./Icon";
import api from "../common/api";
import { UserContext } from "../App";
import { useNavigate, useParams } from "react-router-dom";

const PublishForm = () => {

    let CharacterLimit = 200;
    let tagLimit = 10;

    let { blog_id } = useParams();
    
    let { blog, blog: { banner, title, tags, des, content }, setEditorState, setBlog } = useContext(EditorContext);

    let { userAuth: { access_token } } = useContext(UserContext);

    let navigate = useNavigate();

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
                toast.error(`You can add maximum ${tagLimit} Tags`);
            }

            e.target.value = "";
        }
    }

    const publishBlog = (e) => {

        if(e.target.className.includes("disable")){
            return;
        }

        if(!title.length){
            return toast.error("Write blog title before publishing");
        }

        if(!des.length || des.length > CharacterLimit){
            return toast.error(`Write a description about your blog within ${CharacterLimit} characters to publish`);
        }

        if(!tags.length){
            return toast.error("Enter at least 1 tag to help us rank your blog");
        }

        let loadingToast = toast.loading("Publishing....");

        e.target.classList.add('disable');

        let blogObj = {
            title, banner, des, content, tags, draft: false,
            publication: selectedPub || null
        }

        api.post("/create-blog", { ...blogObj, id: blog_id })
        .then(() => {
            e.target.classList.remove('disable');
            
            toast.dismiss(loadingToast);
            toast.success("Published 👍");

            setTimeout(() => {
                navigate("/dashboard/blogs");
            }, 500);
        })
        .catch(( { response } ) => {
            e.target.classList.remove('disable');
            toast.dismiss(loadingToast);

            return toast.error(response.data.error);

        })

    }

    return(
        <AnimationWrapper>
            <section className="w-full min-h-screen grid items-center lg:grid-cols-2 py-16 lg:gap-4 px-4 sm:px-6">

                <button className="w-10 h-10 absolute right-[5vw] z-10 top-[5%] lg:top-[10%] rounded-full bg-grey hover:bg-grey/80 flex items-center justify-center transition-colors"
                    onClick={handleCloseEvent}
                >
                    <Icon name="close" />
                </button>

                <div className="max-w-[550px] center mt-2">
                    <p className="text-dark-grey mb-1 text-sm font-medium uppercase tracking-wider">Preview</p>

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

                    <p className="text-dark-grey mb-2 mt-9 text-sm font-medium">Topics — Helps in searching and ranking your blog post</p>

                    <div className="relative input-box pl-2 py-2 pb-4">
                        <input type="text" placeholder="Topic" className="sticky input-box bg-surface top-0 left-0 pl-4 mb-3 focus:bg-surface"
                        onKeyDown={handleTagkeyDown}
                        />

                        { 
                            tags.map((tag, i) => {
                                return <Tag tag={tag} tagIndex={i} key={i}/>
                            })
                        }
                    </div>

                    <p className="mt-1 mb-6 text-dark-grey text-sm text-right">{ tagLimit - tags.length } Tags left</p>

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

                    <button className="btn-brand px-8 mt-4"
                        onClick={publishBlog}
                    >Publish</button>

                </div>

            </section>
        </AnimationWrapper>
    )
}

export default PublishForm;