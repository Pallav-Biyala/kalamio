import { useParams } from "react-router-dom";
import InPageNavigation from "../components/inpage-navigation.component";
import { useEffect, useState } from "react";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import BlogPostCard from "../components/blog-post.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import { filterPaginationData } from "../common/filter-pagination-data";

import usePageTitle from "../common/usePageTitle";
import Icon from "../components/Icon";
import api from "../common/api";
import UserCard from "../components/usercard.component";
import NetworkError from "../components/network-error.component";

const SearchPage = () => {
  let { query } = useParams();
  let [ blogs, setBlogs ] = useState(null);
  let [ users, setUsers ] = useState(null);
  let [ blogsError, setBlogsError ] = useState(false);

  usePageTitle(`Search: ${query}`);

  const searchBlogs = ({ page = 1, create_new_arr = false }) => {

    api.post("/search-blogs", { query, page })
    .then( async ({ data }) => {
    
        let formatedData = await filterPaginationData({
            state: blogs,
            data: data.blogs,
            page,
            countRoute: "/search-blogs-count",
            data_to_send: {query},
            create_new_arr
        })
    
        setBlogs(formatedData);
    })
    .catch((err) => {
        setBlogsError(true);
    });

  }

  const fetchUsers = () => {
    api.post("/search-users", {query})
    .then(({ data: { users } } ) => {
        setUsers(users);
    })
  }

  useEffect(() => {

    resetState();
    searchBlogs({ page: 1, create_new_arr: true });
    fetchUsers();
    
  }, [query])

  const resetState = () => {
    setBlogs(null);
    setBlogsError(false);
    fetchUsers(null);
  }

  const UserCardWrapper = () => {
    return(
        <>
            {
                users == null ? <Loader /> :
                    users.length ?
                        users.map((user, i) => {
                            return <AnimationWrapper key={user.personal_info.username} transition={{ duration: 1, delay: i*0.08 }}>
                                <UserCard user={user}/>
                            </AnimationWrapper>
                        })
                    : <NoDataMessage message="No user found" />
            }
        </>
    )
  }

  return (
    <section className="h-cover flex justify-center gap-10">
      <div className="w-full">
        <InPageNavigation
          routes={[`Search Results for "${query}"`, "Accounts Matched"]}
          defaultHidden={"Accounts Matched"}
        >
          <>
            {blogs == null ? (
              blogsError ? (
                <NetworkError onRetry={() => { setBlogsError(false); setBlogs(null); searchBlogs({ page: 1, create_new_arr: true }); }} />
              ) : (
                <Loader />
              )
            ) : blogs.results.length ? (
              blogs.results.map((blog, i) => {
                return (
                  <AnimationWrapper
                    key={blog.blog_id}
                    transition={{ duration: 1, delay: i * 0.1 }}
                  >
                    <BlogPostCard
                      content={blog}
                      author={blog.author.personal_info}
                    />
                  </AnimationWrapper>
                );
              })
            ) : (
              <NoDataMessage message="No blogs published" />
            )}
            <LoadMoreDataBtn
              state={blogs}
              fetchDataFun={searchBlogs}
            />
          </>

          <UserCardWrapper />

        </InPageNavigation>
      </div>

      <div className="min-w-[40%] lg:min-w-[350px] max-w-min border-l border-border pl-8 pt-3 hidden lg:block">

            <h1 className="font-medium text-xl mb-8 flex items-center gap-2">
                Users
                <Icon name="person" className="text-xl text-dark-grey" />
            </h1>

            <UserCardWrapper />

      </div>

    </section>
  );
};

export default SearchPage;
