import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Window-scroll manager for the SPA (a single window scroll is shared across all routes).
 *
 * Behaviour: each route path remembers its own scroll offset. When you return to a path
 * you've already scrolled — whether via the nav tabs (a new navigation) or the browser's
 * Back button — its scroll is restored. Fresh paths start at the top. This is what stops
 * a long article's scroll from carrying into the home feed, AND returns you to where you
 * were in the feed when you come back to it.
 *
 * Reset-to-top override: a link may pass `state={{ resetScroll: true }}` (the logo does)
 * to force the destination to the top, ignoring any saved offset — e.g. tapping the logo
 * should always land on a fresh home feed. It's honoured only on forward navigations, so
 * Back/Forward (POP) always restores where the user actually was.
 *
 * Two details that make it reliable:
 *  - The position is saved in the effect *cleanup*, which runs BEFORE the next path's
 *    effect — so the offset is captured before any restore/reset changes window.scrollY.
 *  - Restoration retries each frame (~1s) because the feed/article loads async and may be
 *    too short to reach the saved offset on the first frame (it would otherwise clamp).
 *
 * Keyed on location.key (not pathname) so a same-path navigation — e.g. tapping the logo
 * while already on "/" — still triggers the reset.
 *
 * The browser's own (SPA-unreliable) scroll restoration is disabled so this is authoritative.
 */

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
}

const MAX_RESTORE_FRAMES = 60; // ~1s at 60fps

const ScrollToTop = () => {
    const location = useLocation();
    const navType = useNavigationType();
    const positions = useRef(new Map());
    const rafRef = useRef(null);

    useLayoutEffect(() => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);

        const { pathname, state } = location;

        // Forward navigation carrying resetScroll (e.g. the logo) forces the top and drops
        // any stored offset. On POP we ignore it and restore where the user was.
        const forceTop = navType !== "POP" && state?.resetScroll;
        if (forceTop) positions.current.delete(pathname);

        const target = forceTop ? 0 : (positions.current.get(pathname) ?? 0);

        if (target > 0) {
            let tries = 0;
            const restore = () => {
                window.scrollTo(0, target);
                const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
                // Content not tall enough yet (async load) — try again next frame.
                if (maxScroll < target && tries++ < MAX_RESTORE_FRAMES) {
                    rafRef.current = requestAnimationFrame(restore);
                }
            };
            restore();
        } else {
            window.scrollTo(0, 0);
        }

        // Runs before the next path's effect → captures this path's scroll before any reset.
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            positions.current.set(pathname, window.scrollY);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    return null;
};

export default ScrollToTop;
