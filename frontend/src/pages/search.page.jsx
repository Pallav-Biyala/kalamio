import { useParams } from "react-router-dom";
import InPageNavigation from "../components/inpage-navigation.component";
import Loader from "../components/loader.component";
import AnimationWrapper from "../common/page-animation";
import BlogPostCard from "../components/blog-post.component";
import NoDataMessage from "../components/nodata.component";
import LoadMoreDataBtn from "../components/load-more.component";
import { useSeo } from "../common/useSeo";
import Icon from "../components/Icon";
import UserCard from "../components/usercard.component";
import NetworkError from "../components/network-error.component";
import { useSearchBlogs, useSearchUsers } from "../hooks/queries";

const SearchPage = () => {
  let { query } = useParams();

  useSeo({ title: `Search: ${query}`, noindex: true });

  // TanStack Query hooks — automatically refetch when query changes
  const blogsQuery = useSearchBlogs(query);
  const { data: users, isLoading: usersLoading } = useSearchUsers(query);

  const blogs = blogsQuery.data?.blogs || [];

  const UserCardWrapper = () => {
    return(
        <>
            {
                usersLoading ? <Loader /> :
                    users?.length ?
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
            {blogsQuery.isLoading ? (
              <Loader />
            ) : blogsQuery.isError ? (
              <NetworkError onRetry={() => blogsQuery.refetch()} />
            ) : blogs.length ? (
              blogs.map((blog, i) => {
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
              fetchNextPage={blogsQuery.fetchNextPage}
              hasNextPage={blogsQuery.hasNextPage}
              isFetchingNextPage={blogsQuery.isFetchingNextPage}
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
