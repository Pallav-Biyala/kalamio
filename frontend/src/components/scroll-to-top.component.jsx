import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * Window-scroll manager for the SPA (a single window scroll is shared across all routes).
 *
 * Restore model — two memories, because "Back" and "tab click" want different things:
 *  - byKey  (location.key -> offset): the exact scroll of each history entry. Authoritative
 *    on POP (browser Back/Forward) so returning to an entry lands exactly where it was, even
 *    when several history entries share the same pathname.
 *  - byPath (pathname -> last offset): the last-known scroll for a path, used on a forward
 *    navigation (nav tab / link) so returning to the feed via the tab restores your place.
 * Fresh entries/paths start at the top, so a long article's scroll never carries into the feed.
 *
 * Reset-to-top override: a link may pass `state={{ resetScroll: true }}` (the logo does) to
 * force the destination to the top on a forward navigation, ignoring any saved offset. POP
 * always restores (a stale reset flag on a history entry never forces the top on Back).
 *
 * Detecting "the user took over": we watch real input gestures, NOT scrollY movement. A raw
 * scrollY delta can't tell a deliberate scroll from a browser-forced one — scroll anchoring
 * shifting the view as content loads above, or the clamp when a page shrinks below the current
 * offset — so inferring intent from it mis-saves transient positions. Instead:
 *   - wheel (vertical) / scroll keys → immediate takeover;
 *   - touch → the climb pauses while a finger is down (never fights it) and counts as takeover
 *     only if the scroll actually moved between touchstart and touchend, so an overscroll bounce
 *     or a horizontal edge-swipe-back (which fire touch events but don't scroll) is ignored.
 * Accepted minor gesture-detection edges (all rare, non-corrupting, self-healing on the next
 * scroll — not worth the complexity/regression risk of closing): scrollbar-drag / middle-click
 * autoscroll emit only `scroll` (no gesture event), so a restore may briefly re-assert against
 * them during the ≤4s climb — adding a `scroll` listener would re-introduce the anchoring/clamp
 * false-positives above; a second finger landing mid-gesture resets touchBaseline; a scroll key
 * pressed while a non-text interactive element (button/select) is focused counts as takeover.
 *
 * Saving offsets happens in the effect *cleanup* (which runs before the next route's effect, so
 * the scroll is captured before any restore/reset moves it), but only when the position is real:
 * if a restore never reached target and the user never took over, window.scrollY is a transient
 * artifact (a loader-phase 0, or a clamped short-page bottom), so the good saved offset is kept.
 *
 * Keyed on location.key (not pathname) so a same-path navigation — tapping the logo while already
 * on "/" — still triggers the reset.
 *
 * Same-route resets: a view that scrolls itself to the top without navigating (a home category
 * switch calls window.scrollTo(0,0) then setState — no location.key change) must call the exported
 * cancelScrollRestore() first, so an in-flight restore from arriving at the feed doesn't survive
 * the loader phase and later yank the newly-switched view to the old offset.
 *
 * The browser's own (SPA-unreliable) scroll restoration is disabled so this is authoritative.
 */

if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
}

const RESTORE_DEADLINE_MS = 4000; // stop chasing target after this long (async content never arrived)
const MEMORY_CAP = 50;            // LRU bound per map so a long session can't grow them unbounded
const TOUCH_SCROLL_MIN = 8;       // px moved during a touch to count it as a real scroll (vs overscroll)
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " ", "Spacebar"]);

// Insert/refresh a key as most-recently-used and evict the oldest past the cap.
const remember = (map, k, v) => {
    map.delete(k);
    map.set(k, v);
    if (map.size > MEMORY_CAP) map.delete(map.keys().next().value);
};

// The in-flight restore for the singleton manager. Exposed for cancelScrollRestore().
let active = null;

/**
 * Abort any in-flight scroll restore. Call this from a same-route "scroll to top" reset (which
 * doesn't re-run the manager's route effect) before scrolling, so the restore can't resume and
 * fight the reset. Marks it released so the manager saves the new position on the next navigation.
 */
export const cancelScrollRestore = () => {
    if (active) {
        active.released = true;
        active.stop();
    }
};

/**
 * Drive the window scroll to `target`, re-asserting as async content grows the page, until it's
 * reached, the user takes over, or the deadline elapses. Returns a controller { reached, released,
 * stop }.
 *
 * Clamps to the current max scroll so the browser is never asked to overshoot. On the deadline the
 * climb stops but the input listeners stay attached, so a later user scroll on a short/unreachable
 * destination is still recorded (and the stale target isn't preserved over their real position).
 */
const startRestore = (target) => {
    const root = document.documentElement;
    let startTs = -1;
    let raf = 0;
    let climbing = true;
    let listening = true;
    let touching = false;
    let touchBaseline = 0;

    const ctrl = { reached: false, released: false };

    const stopClimb = () => {
        if (!climbing) return;
        climbing = false;
        if (raf) cancelAnimationFrame(raf);
    };

    const removeListeners = () => {
        if (!listening) return;
        listening = false;
        window.removeEventListener("wheel", onWheel);
        window.removeEventListener("keydown", onKey);
        window.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("touchend", onTouchEnd);
        window.removeEventListener("touchcancel", onTouchEnd);
    };

    const fullStop = () => { stopClimb(); removeListeners(); };
    ctrl.stop = fullStop;

    const takeover = () => { ctrl.released = true; fullStop(); };

    function onWheel(e) { if (e.deltaY !== 0) takeover(); } // vertical intent only
    function onKey(e) {
        if (!SCROLL_KEYS.has(e.key)) return;
        const t = e.target; // ignore caret movement / Space inside a field
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        takeover();
    }
    function onTouchStart() { touching = true; touchBaseline = window.scrollY; }
    function onTouchEnd() {
        if (!touching) return;
        touching = false;
        // Only a touch that actually scrolled the page is a takeover; an overscroll bounce or a
        // horizontal edge-swipe-back leaves scrollY put and lets the climb resume.
        if (Math.abs(window.scrollY - touchBaseline) > TOUCH_SCROLL_MIN) takeover();
    }

    window.addEventListener("wheel", onWheel, { passive: true });
    window.addEventListener("keydown", onKey);
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    const step = (ts) => {
        if (!climbing) return;

        if (!touching) { // never fight a finger that's down
            const maxScroll = Math.max(0, root.scrollHeight - window.innerHeight);
            const y = Math.min(target, maxScroll);
            window.scrollTo(0, y);
            if (y >= target) { // reached the saved offset
                ctrl.reached = true;
                return fullStop();
            }
        }

        if (ts != null) {
            if (startTs < 0) startTs = ts;
            else if (ts - startTs > RESTORE_DEADLINE_MS) return stopClimb(); // keep listening
        }
        raf = requestAnimationFrame(step);
    };

    step(); // initial synchronous assertion (pre-paint); ts is undefined so the deadline isn't armed yet
    return ctrl;
};

const ScrollToTop = () => {
    const location = useLocation();
    const navType = useNavigationType();
    const byKey = useRef(new Map());
    const byPath = useRef(new Map());

    useLayoutEffect(() => {
        const { key, pathname, state } = location;

        let target;
        if (navType === "POP") {
            target = byKey.current.get(key) ?? 0;              // Back/Forward → exact entry
        } else if (state?.resetScroll) {
            target = 0;                                        // logo/"home" → force top
        } else {
            target = byPath.current.get(pathname) ?? 0;        // forward nav → path's last offset
        }

        if (target > 0) {
            active = startRestore(target);
        } else {
            active = null;
            window.scrollTo(0, 0);
        }

        return () => {
            const ctrl = active;
            if (ctrl) ctrl.stop();

            // Save only a real position: a restore that reached target or was released (user scroll
            // / cancel) leaves one. A restore still climbing / stalled on a short page leaves a
            // transient window.scrollY, so preserve the previously saved offset instead.
            const settled = !ctrl || ctrl.reached || ctrl.released;
            if (settled) {
                const y = window.scrollY;
                remember(byKey.current, key, y);
                remember(byPath.current, pathname, y);
            }
            active = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    return null;
};

export default ScrollToTop;
