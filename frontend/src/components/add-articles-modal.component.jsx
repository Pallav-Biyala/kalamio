import { useState, useEffect } from "react";
import Icon from "./Icon";
import Loader from "./loader.component";
import { InfiniteScrollTrigger } from "./load-more.component";
import { cdnUrl } from "../common/cdn";
import { getRelativeTime } from "../common/date";
import toast from "react-hot-toast";
import usePublicationArticlePicker from "../hooks/queries/usePublicationArticlePicker";
import { useAddArticleToPublication, useRemoveArticleFromPublication } from "../hooks/mutations";

/**
 * "Add existing articles to a publication" picker.
 *
 * Lists the owner's published articles (searchable, infinite-scroll) with a thumbnail, and a single
 * toggle per row that adds / removes the article from this publication. Articles already in ANOTHER
 * publication show that membership and a "Move here" action (the server handles the move + counters).
 * All writes go through the /publication/add-blog & /remove-blog endpoints so total_posts counters
 * and the publications cache stay correct.
 *
 * @param {{ publicationId: string, publicationSlug: string, publicationTitle: string,
 *           isOpen: boolean, onClose: () => void, onChanged?: () => void }} props
 */
const AddArticlesModal = ({ publicationId, publicationSlug, publicationTitle, isOpen, onClose, onChanged }) => {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState(null);

  // Debounce the search box → query (used as the fetch key), so typing doesn't fire a request/keystroke.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const picker = usePublicationArticlePicker({ query, enabled: isOpen });
  const addMut = useAddArticleToPublication();
  const removeMut = useRemoveArticleFromPublication();

  if (!isOpen) return null;

  const articles = picker.data?.blogs || [];
  const publicationRef = { _id: publicationId, title: publicationTitle, slug: publicationSlug };

  const toggle = (post) => {
    if (pendingId) return; // one in-flight change at a time keeps the counters/UI unambiguous
    const inThis = post.publication && post.publication._id === publicationId;
    setPendingId(post._id);
    const opts = {
      onSuccess: () => {
        toast.success(inThis ? "Removed from publication" : "Added to publication");
        onChanged?.();
      },
      onError: () => toast.error("Something went wrong. Please try again."),
      onSettled: () => setPendingId(null),
    };
    if (inThis) removeMut.mutate({ blogMongoId: post._id }, opts);
    else addMut.mutate({ blogMongoId: post._id, publicationId, publicationRef }, opts);
  };

  return (
    <div className="article-picker-overlay" onClick={onClose}>
      <div className="article-picker-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="article-picker-modal__header">
          <div className="min-w-0">
            <h2 className="article-picker-modal__title">Add articles</h2>
            <p className="article-picker-modal__subtitle">to {publicationTitle}</p>
          </div>
          <button onClick={onClose} className="article-picker-modal__close" aria-label="Close">
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        {/* Search */}
        <div className="article-picker-modal__search">
          <Icon name="search" className="article-picker-modal__search-icon" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your articles"
            className="article-picker-modal__search-input"
            autoFocus
          />
          {search && (
            <button className="article-picker-modal__search-clear" onClick={() => setSearch("")} aria-label="Clear search">
              <Icon name="close" className="text-base" />
            </button>
          )}
        </div>

        {/* List */}
        <div className="article-picker-modal__content">
          {picker.isLoading ? (
            <div className="py-10"><Loader /></div>
          ) : articles.length === 0 ? (
            <div className="article-picker-modal__empty">
              <Icon name="article" className="text-4xl text-dark-grey/30" />
              <p className="text-dark-grey text-sm mt-2">
                {query ? "No articles match your search" : "You haven't published any articles yet"}
              </p>
            </div>
          ) : (
            <>
              {articles.map((post) => {
                const inThis = post.publication && post.publication._id === publicationId;
                const inOther = post.publication && post.publication._id !== publicationId;
                const busy = pendingId === post._id;
                return (
                  <div key={post._id} className="article-picker-row">
                    <div className="article-picker-row__thumb">
                      {post.banner
                        ? <img src={cdnUrl(post.banner)} alt="" loading="lazy" />
                        : <Icon name="article" className="text-xl text-dark-grey/40" />}
                    </div>
                    <div className="article-picker-row__body">
                      <span className="article-picker-row__title">{post.title || "Untitled"}</span>
                      <span className="article-picker-row__meta">
                        <span>{getRelativeTime(post.publishedAt)}</span>
                        {inOther && (
                          <span className="article-picker-row__badge">
                            <Icon name="import_contacts" className="text-xs" /> In {post.publication.title}
                          </span>
                        )}
                      </span>
                    </div>
                    <button
                      onClick={() => toggle(post)}
                      disabled={busy || (!!pendingId && !busy)}
                      className={`article-picker-row__action${inThis ? " is-added" : ""}`}
                      title={inThis ? "Remove from this publication" : inOther ? `Move here from ${post.publication.title}` : "Add to this publication"}
                    >
                      {busy
                        ? <Icon name="sync" className="text-base animate-spin" />
                        : <Icon name={inThis ? "check" : "add"} className="text-base" />}
                      {inThis ? "Added" : inOther ? "Move here" : "Add"}
                    </button>
                  </div>
                );
              })}
              <InfiniteScrollTrigger
                fetchNextPage={picker.fetchNextPage}
                hasNextPage={picker.hasNextPage}
                isFetchingNextPage={picker.isFetchingNextPage}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddArticlesModal;
