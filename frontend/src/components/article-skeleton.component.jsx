/**
 * Loading placeholder for the blog READING page (`blog.page`).
 *
 * Why this exists: the page used to fall back to the generic feed `<Loader>`, which draws three blog
 * *cards* (avatar + title lines + a square thumbnail). On an article that skeleton is the wrong shape
 * entirely, so when the real post arrived the layout lurched from ~840px of fake cards to the full
 * article (measured ~3800px document jump) — the "fluctuation on open" on mobile. This mirrors the
 * article's own structure (title → subtitle → tags → author → banner → body) at the same widths, so
 * the swap to real content barely moves anything on screen.
 *
 * `variant="text"` for text posts (`/blog/tp-…`), which have no title or banner — just an author row
 * and lines of text.
 */
const Line = ({ w = 'w-full', h = 'h-5', className = '' }) => (
    <div className={`skeleton ${h} ${w} rounded-full ${className}`} />
);

const Paragraph = () => (
    <div className="mb-5">
        <Line className="mb-2.5" />
        <Line className="mb-2.5" />
        <Line w="w-[88%]" />
    </div>
);

const ArticleSkeleton = ({ variant = 'article' }) => {
    const isText = variant === 'text';

    return (
        <div className="max-w-[900px] w-full center max-lg:px-[5vw] max-lg:pt-0 max-lg:pb-10 lg:py-10 animate-pulse">
            {isText ? (
                <div className="max-w-[720px] mx-auto mt-4 md:mt-8">
                    {/* Author row */}
                    <div className="flex gap-4 items-center mb-6">
                        <div className="skeleton w-12 h-12 rounded-full flex-none" />
                        <div className="flex-1">
                            <Line h="h-4" w="w-40" className="mb-2" />
                            <Line h="h-3.5" w="w-28" />
                        </div>
                    </div>
                    {/* Text body */}
                    <Paragraph />
                    <Paragraph />
                    <Paragraph />
                </div>
            ) : (
                <>
                    {/* Title (two lines), subtitle, tags, author — matches the article header block. */}
                    <div className="max-w-[720px] mx-auto mt-4 md:mt-8">
                        <div className="skeleton h-9 md:h-12 w-[94%] rounded-xl mb-3" />
                        <div className="skeleton h-9 md:h-12 w-[62%] rounded-xl mb-6" />

                        <Line className="mb-2.5" />
                        <Line w="w-[78%]" className="mb-7" />

                        <div className="flex flex-wrap gap-2 mb-8">
                            <div className="skeleton h-6 w-16 rounded-full" />
                            <div className="skeleton h-6 w-20 rounded-full" />
                            <div className="skeleton h-6 w-14 rounded-full" />
                        </div>

                        <div className="flex items-center gap-4 mb-8">
                            <div className="skeleton w-12 h-12 rounded-full flex-none" />
                            <div className="flex-1">
                                <Line h="h-4" w="w-40" className="mb-2" />
                                <Line h="h-3.5" w="w-28" />
                            </div>
                        </div>
                    </div>

                    {/* Banner — same aspect ratio the real one reserves, so no second jump when it loads. */}
                    <div className="my-8 md:my-12 max-sm:-ml-[5vw] max-sm:w-screen">
                        <div className="skeleton w-full aspect-video md:aspect-[2/1] sm:rounded-2xl" />
                    </div>

                    {/* Body */}
                    <div className="max-w-[720px] mx-auto">
                        <Paragraph />
                        <Paragraph />
                        <Paragraph />
                        <Paragraph />
                    </div>
                </>
            )}
        </div>
    );
};

export default ArticleSkeleton;
