import { useContext, useEffect, useState } from "react";
import usePageTitle from "../common/usePageTitle";
import Icon from "../components/Icon";
import { UserContext } from "../App";
import { filterPaginationData } from "../common/filter-pagination-data";
import api from "../common/api";
import toast from "react-hot-toast";
import InPageNavigation from "../components/inpage-navigation.component";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import AnimationWrapper from "../common/page-animation";
import { ManagePublishedBlogsCard, ManageDraftBlogPost } from "../components/manage-blogcard.component";
import LoadMoreDataBtn from "../components/load-more.component";
import { useSearchParams } from "react-router-dom";

const SORT_OPTIONS = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "most_liked", label: "Most Liked" },
    { value: "most_read", label: "Most Read" },
];

const ManageBlogs = () => {

    usePageTitle('Manage Blogs');

    const [ blogs, setBlogs ] = useState(null);
    const [ drafts, setDrafts ] = useState(null);
    const [ query, setQuery ] = useState("");
    const [ sort, setSort ] = useState("newest");
    const [ selectedBlogs, setSelectedBlogs ] = useState(new Set());
    const [ deleting, setDeleting ] = useState(false);

    let activeTab = useSearchParams()[0].get("tab");

    let { userAuth: { access_token } } = useContext(UserContext);

    const getBlogs = ({ page, draft, deletedDocCount = 0 }) => {

        api.post("/user-written-blogs", {
            page, draft, query, deletedDocCount,
            sort: draft ? "newest" : sort
        })
        .then( async ({ data }) => {
            let formatedData = await filterPaginationData({
                state: draft ? drafts : blogs,
                data: data.blogs,
                page,
                user: access_token,
                countRoute: "/user-written-blogs-count",
                data_to_send: { draft, query }
            })

            if(draft){
                setDrafts(formatedData);
            } else {
                setBlogs(formatedData);
            }
        })
        .catch(err => {
        })
    }

    useEffect(() => {

        if(access_token){
            if(blogs == null){
                getBlogs({ page: 1, draft: false });
            }
            if(drafts == null){
                getBlogs({ page: 1, draft: true });
            }
        }

    }, [access_token, blogs, drafts, query])

    // Re-fetch published blogs when sort changes
    useEffect(() => {
        if (access_token) {
            setBlogs(null);
        }
    }, [sort]);

    const handleChange = (e) => {
        if(!e.target.value.length){
            setQuery("");
            setBlogs(null);
            setDrafts(null);
        }
    }

    const handleSearch = (e) => {
        let searchQuery = e.target.value;

        setQuery(searchQuery);

        if(e.keyCode == 13 && searchQuery.length){
            setBlogs(null);
            setDrafts(null);
        }
    }

    const toggleSelectBlog = (blog_id) => {
        setSelectedBlogs(prev => {
            const newSet = new Set(prev);
            if (newSet.has(blog_id)) {
                newSet.delete(blog_id);
            } else {
                newSet.add(blog_id);
            }
            return newSet;
        });
    };

    const selectAllPublished = () => {
        if (!blogs?.results) return;
        const allIds = blogs.results.map(b => b.blog_id);
        const allSelected = allIds.every(id => selectedBlogs.has(id));
        
        if (allSelected) {
            setSelectedBlogs(new Set());
        } else {
            setSelectedBlogs(new Set(allIds));
        }
    };

    const handleBulkDelete = () => {
        if (selectedBlogs.size === 0) return;

        const confirmMsg = `Delete ${selectedBlogs.size} blog${selectedBlogs.size > 1 ? 's' : ''}? This cannot be undone.`;
        if (!window.confirm(confirmMsg)) return;

        setDeleting(true);

        api.post("/bulk-delete-blogs", { blog_ids: Array.from(selectedBlogs) })
        .then(({ data }) => {
            toast.success(`Deleted ${data.deleted_count} blog${data.deleted_count > 1 ? 's' : ''}`);
            setSelectedBlogs(new Set());
            setBlogs(null);
            setDrafts(null);
            setDeleting(false);
        })
        .catch(() => {
            toast.error("Failed to delete blogs");
            setDeleting(false);
        });
    };

    const isAllSelected = blogs?.results?.length > 0 && blogs.results.every(b => selectedBlogs.has(b.blog_id));

    return (
        <>
            <h1 className="max-md:hidden">Manage Blogs</h1>

            <div className="relative max-md:mt-5 md:mt-8 mb-6">
                <input 
                    type="search"
                    className="w-full bg-grey p-4 pl-12 pr-6 rounded-full placeholder:text-dark-grey"
                    placeholder="Search Blogs"
                    onChange={handleChange}
                    onKeyDown={handleSearch}
                />

                <Icon name="search" className="absolute right-[10%] md:pointer-events-none md:left-5 top-1/2 -translate-y-1/2 text-xl text-dark-grey" />
            </div>

            {/* Sort + Bulk Actions Bar */}
            <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
                <div className="flex items-center gap-3">
                    <label className="text-sm text-dark-grey">Sort:</label>
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        className="manage-blogs__sort-select"
                    >
                        {SORT_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                </div>

                {selectedBlogs.size > 0 && (
                    <div className="manage-blogs__bulk-bar">
                        <span className="text-sm font-medium">
                            {selectedBlogs.size} selected
                        </span>
                        <button
                            className="manage-blogs__bulk-delete"
                            onClick={handleBulkDelete}
                            disabled={deleting}
                        >
                            <Icon name="delete" className="text-[18px]" />
                            {deleting ? "Deleting..." : "Delete Selected"}
                        </button>
                    </div>
                )}
            </div>

            <InPageNavigation routes={["Published Blogs", "Draft Blogs"]} defaultActiveIndex={ activeTab != 'draft' ? 0 : 1 }>

                {// Published blogs

                    blogs == null ? <Loader /> : 
                    blogs.results.length ? 
                        
                        <>

                        {/* Select All */}
                        <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
                            <button
                                onClick={selectAllPublished}
                                className="flex items-center gap-2 text-sm text-dark-grey hover:text-black transition-colors"
                            >
                                <Icon name={isAllSelected ? "check_box" : "check_box_outline_blank"} className="text-[20px]" />
                                Select All
                            </button>
                        </div>

                        {
                            blogs.results.map((blog, i) => {
                                return <AnimationWrapper key={i} transition={{ delay: i * 0.04 }}>
                                    
                                    <ManagePublishedBlogsCard
                                        blog={{...blog, index: i, setStateFun: setBlogs }}
                                        isSelected={selectedBlogs.has(blog.blog_id)}
                                        onToggleSelect={() => toggleSelectBlog(blog.blog_id)}
                                    />

                                </AnimationWrapper>
                            })
                        }

                        <LoadMoreDataBtn state={blogs} fetchDataFun={getBlogs} additionalParam={{ draft: false, deletedDocCount: blogs.deletedDocCount }} />

                        </>
                    
                    : <NoDataMessage message="No published blogs" />

                }
                
                {// Draft blogs

                    drafts == null ? <Loader /> : 
                    drafts.results.length ? 
                        
                        <>
                        {
                            drafts.results.map((blog, i) => {
                                return <AnimationWrapper key={i} transition={{ delay: i * 0.04 }}>
                                    
                                    <ManageDraftBlogPost blog={{...blog, index: i, setStateFun: setDrafts }} />

                                </AnimationWrapper>
                            })
                        }

                        <LoadMoreDataBtn state={drafts} fetchDataFun={getBlogs} additionalParam={{ draft: true, deletedDocCount: drafts.deletedDocCount }} />

                        </>
                    
                    : <NoDataMessage message="No draft blogs" />

                }

            </InPageNavigation>

        </>
    )
}

export default ManageBlogs;