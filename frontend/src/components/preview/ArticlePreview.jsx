import Avatar from "../Avatar";
import Icon from "../Icon";
import BlogContent from "../blog-content.component";
import { cdnUrl } from "../../common/cdn";

// Normalize the editor/content shape ({doc} or [{doc}]) to the doc node.
const asDoc = (content) => (Array.isArray(content) ? content[0] : content);

// Rough client-side read-time (~200 wpm) from the Tiptap doc, purely for the preview meta line.
const estimateReadTime = (content) => {
    const doc = asDoc(content);
    if (!doc || typeof doc !== "object") return 1;
    let text = "";
    const walk = (node) => {
        if (!node) return;
        if (node.type === "text" && node.text) text += node.text + " ";
        (node.content || []).forEach(walk);
    };
    walk(doc);
    const words = text.trim().split(/\s+/).filter(Boolean).length;
    return Math.max(1, Math.round(words / 200));
};

const hasContent = (content) => {
    const doc = asDoc(content);
    return !!(
        doc && doc.content && doc.content.length > 0 &&
        !(doc.content.length === 1 && doc.content[0].type === "paragraph" && !doc.content[0].content)
    );
};

/**
 * Static, non-interactive replica of the published article's interaction bar (see blog-interaction.
 * component.jsx) — the same markup/classes so it looks identical, but display-only (no context or
 * network). Counts read 0, matching a freshly published article.
 */
const PreviewInteractionBar = () => (
    <div aria-hidden="true">
        <hr className="border-border/50 my-2" />
        <div className="flex gap-4 sm:gap-6 justify-between flex-wrap py-1">
            <div className="flex gap-2.5 items-center">
                <span className="w-8 h-8 rounded-full flex items-center justify-center bg-grey">
                    <Icon name="favorite_border" className="text-[18px]" />
                </span>
                <p className="text-base text-dark-grey">0</p>
                <span className="w-8 h-8 rounded-full flex items-center justify-center bg-grey ml-2">
                    <Icon name="chat_bubble" className="text-[18px]" />
                </span>
                <p className="text-base text-dark-grey">0</p>
            </div>
            <div className="flex gap-4 sm:gap-6 items-center">
                <span className="text-dark-grey flex items-center gap-1 text-sm font-medium select-none">
                    <Icon name="bookmark" className="text-lg" />
                    Save
                </span>
                <span className="text-dark-grey flex items-center gap-1 text-sm font-medium select-none">
                    <Icon name="link" className="text-lg" />
                    Share
                </span>
            </div>
        </div>
        <hr className="border-border/50 my-2" />
    </div>
);

/**
 * Non-interactive replica of the published reading page (see blog.page.jsx layout) shown inside the
 * preview iframe. It reuses the REAL content renderer (BlogContent → TiptapRenderer) so the body is
 * pixel-identical to the live article, and its layout/typography come from self-contained `.article-
 * preview*` classes (plain CSS in index.css) rather than Tailwind utilities — so the 900/720 columns
 * and the banner crop hold correctly inside the iframe no matter how utilities resolve there. The
 * interaction bar is shown as a static (display-only) replica; the remaining id/network-bound widgets
 * (comments, follow, similar posts, read tracker) are omitted.
 */
const ArticlePreview = ({ blog }) => {
    const { title, des, banner, tags, content, author } = blog;
    const info = author?.personal_info || {};

    return (
        <div className="article-preview">
            <div className="article-preview__col">
                <h1 className="article-preview__title">{title || "Untitled article"}</h1>

                {des && <p className="article-preview__des">{des}</p>}

                {tags?.length > 0 && (
                    <div className="article-preview__tags">
                        {tags.map((t, i) => <span key={i} className="article-preview__tag">#{t}</span>)}
                    </div>
                )}

                <div className="article-preview__author">
                    <Avatar src={info.profile_img} alt={info.fullname} size={48} />
                    <div>
                        <p className="article-preview__author-name">{info.fullname || "You"}</p>
                        <p className="article-preview__author-meta">
                            <Icon name="edit_note" className="text-base" />
                            Draft preview · {estimateReadTime(content)} min read
                        </p>
                    </div>
                </div>

                <div className="mt-4">
                    <PreviewInteractionBar />
                </div>
            </div>

            {banner && <img src={cdnUrl(banner)} alt="" className="article-preview__banner" />}

            <div className="article-preview__col">
                <div className="article-preview__body blog-page-content" style={{ lineHeight: "1.9" }}>
                    {hasContent(content)
                        ? <BlogContent content={content} />
                        : <p className="article-preview__empty">Start writing to see your article here.</p>}
                </div>
                <PreviewInteractionBar />
            </div>
        </div>
    );
};

export default ArticlePreview;
