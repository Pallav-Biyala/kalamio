import { useContext, useState } from "react";
import usePageTitle from "../common/usePageTitle";
import Icon from "../components/Icon";
import { UserContext } from "../App";
import InPageNavigation from "../components/inpage-navigation.component";
import Loader from "../components/loader.component";
import NoDataMessage from "../components/nodata.component";
import AnimationWrapper from "../common/page-animation";
import { ManagePublishedBlogsCard, ManageDraftBlogPost } from "../components/manage-blogcard.component";
import LoadMoreDataBtn from "../components/load-more.component";
import { useSearchParams } from "react-router-dom";
import { useUserBlogs } from "../hooks/queries";
import { useBulkDeleteBlogs } from "../hooks/mutations";
import ConfirmModal from "../components/confirm-modal.component";

const SORT_OPTIONS = [
    { value: "newest", label: "Newest First" },
    { value: "oldest", label: "Oldest First" },
    { value: "most_liked", label: "Most Liked" },
    { value: "most_read", label: "Most Read" },
];

const ManageBlogs = () => {

    usePageTitle('Manage Blogs');

    const [ query, setQuery ] = useState("");
    const [ sort, setSort ] = useState("newest");
    const [ selectedBlogs, setSelectedBlogs ] = useState(new Set());
    const [ showBulkDeleteConfirm, setShowBulkDeleteConfirm ] = useState(false);

    let activeTab = useSearchParams()[0].get("tab");

    let { userAuth: { access_token } } = useContext(UserContext);

    // TanStack Query hooks — two separate infinite queries for published and drafts
    const publishedQuery = useUserBlogs({ draft: false, query, sort });
    const draftsQuery = useUserBlogs({ draft: true, query, sort: 'newest' });

    const bulkDelete = useBulkDeleteBlogs();

    const publishedBlogs = publishedQuery.data?.blogs || [];
    const draftBlogs = draftsQuery.data?.blogs || [];

    const handleChange = (e) => {
        if(!e.target.value.length){
            setQuery("");
        }
    }

    const handleSearch = (e) => {
        let searchQuery = e.target.value;

        if(e.keyCode == 13 && searchQuery.length){
            setQuery(searchQuery);
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
        if (!publishedBlogs.length) return;
        const allIds = publishedBlogs.map(b => b.blog_id);
        const allSelected = allIds.every(id => selectedBlogs.has(id));
        
        if (allSelected) {
            setSelectedBlogs(new Set());
        } else {
            setSelectedBlogs(new Set(allIds));
        }
    };

    const handleBulkDelete = () => {
        if (selectedBlogs.size === 0) return;
        setShowBulkDeleteConfirm(true);
    };

    const confirmBulkDelete = () => {
        setShowBulkDeleteConfirm(false);

        bulkDelete.mutate(
            { blog_ids: Array.from(selectedBlogs) },
            { onSuccess: () => setSelectedBlogs(new Set()) }
        );
    };

    const isAllSelected = publishedBlogs.length > 0 && publishedBlogs.every(b => selectedBlogs.has(b.blog_id));

    return (
        <>
            <ConfirmModal
                isOpen={showBulkDeleteConfirm}
                title={`Delete ${selectedBlogs.size} blog${selectedBlogs.size > 1 ? 's' : ''}?`}
                message={`The selected blog${selectedBlogs.size > 1 ? 's' : ''} will be permanently deleted along with all reads, likes and comments. This cannot be undone.`}
                confirmLabel="Delete"
                variant="danger"
                onConfirm={confirmBulkDelete}
                onCancel={() => setShowBulkDeleteConfirm(false)}
            />

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
                            disabled={bulkDelete.isPending}
                        >
                            <Icon name="delete" className="text-[18px]" />
                            {bulkDelete.isPending ? "Deleting..." : "Delete Selected"}
                        </button>
                    </div>
                )}
            </div>

            <InPageNavigation routes={["Published Blogs", "Draft Blogs"]} defaultActiveIndex={ activeTab != 'draft' ? 0 : 1 }>

                {// Published blogs

                    publishedQuery.isLoading ? <Loader /> : 
                    publishedBlogs.length ? 
                        
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
                            publishedBlogs.map((blog, i) => {
                                return <AnimationWrapper key={blog.blog_id || i} transition={{ delay: i * 0.04 }}>
                                    
                                    <ManagePublishedBlogsCard
                                        blog={{...blog, index: i }}
                                        isSelected={selectedBlogs.has(blog.blog_id)}
                                        onToggleSelect={() => toggleSelectBlog(blog.blog_id)}
                                    />

                                </AnimationWrapper>
                            })
                        }

                        <LoadMoreDataBtn
                            fetchNextPage={publishedQuery.fetchNextPage}
                            hasNextPage={publishedQuery.hasNextPage}
                            isFetchingNextPage={publishedQuery.isFetchingNextPage}
                        />

                        </>
                    
                    : <NoDataMessage message="No published blogs" />

                }
                
                {// Draft blogs

                    draftsQuery.isLoading ? <Loader /> : 
                    draftBlogs.length ? 
                        
                        <>
                        {
                            draftBlogs.map((blog, i) => {
                                return <AnimationWrapper key={blog.blog_id || i} transition={{ delay: i * 0.04 }}>
                                    
                                    <ManageDraftBlogPost blog={{...blog, index: i }} />

                                </AnimationWrapper>
                            })
                        }

                        <LoadMoreDataBtn
                            fetchNextPage={draftsQuery.fetchNextPage}
                            hasNextPage={draftsQuery.hasNextPage}
                            isFetchingNextPage={draftsQuery.isFetchingNextPage}
                        />

                        </>
                    
                    : <NoDataMessage message="No draft blogs" />

                }

            </InPageNavigation>

        </>
    )
}

export default ManageBlogs;