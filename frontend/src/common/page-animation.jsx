import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * Ids whose entrance animation has already played this session.
 *
 * Module-level on purpose: it must OUTLIVE unmounts. Navigating Home → Dashboard → Home unmounts
 * and remounts the feed, and framer replays `initial → animate` on every fresh mount — so a
 * returning feed re-ran a staggered fade over cards whose images were already cached, which reads
 * as "the images are loading again". Remembering what has been seen lets a return render settled.
 */
const seenOnce = new Set();

// The feed is infinite, so cap the set rather than let it grow all session. This is well past any
// realistic scroll depth, and the worst case of an eviction is one extra fade.
const SEEN_LIMIT = 5000;

const markSeen = (id) => {
    if (seenOnce.size >= SEEN_LIMIT) seenOnce.clear();
    seenOnce.add(id);
};

/**
 * @param {*} [once] — A stable id (e.g. blog_id). When given, the entrance animation plays only the
 *   FIRST time that id mounts; later remounts render at the final state instantly. Omit it for
 *   page-level transitions, which should still animate on every visit.
 */
const AnimationWrapper = ({ children, keyValue, once, initial={opacity: 0.4}, animate={opacity: 1}, transition={duration: 0.15, ease: "easeOut"}, className }) => {

    // Captured at mount: was this id already seen BEFORE this mount? Holding it in a ref keeps the
    // answer stable across re-renders, and marking it in an effect keeps render side-effect free
    // (and StrictMode's double-invoke harmless, since Set.add is idempotent).
    const isRepeat = useRef(once != null && seenOnce.has(once));

    useEffect(() => {
        if (once != null) markSeen(once);
    }, [once]);

    // `initial={false}` tells framer to start AT the animate state — no entrance, no flash.
    const skip = isRepeat.current;

    return(
        <AnimatePresence>
            <motion.div
                key={keyValue}
                initial={skip ? false : initial}
                animate={animate}
                transition={skip ? { duration: 0 } : transition}
                className={className}
            >
                { children }
            </motion.div>
        </AnimatePresence>
    )
}

export default AnimationWrapper;
