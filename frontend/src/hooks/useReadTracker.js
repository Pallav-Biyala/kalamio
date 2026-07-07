import { useEffect, useRef, useCallback, useContext } from "react";
import api from "../common/api";
import { UserContext } from "../App";

// ─────────────────────────────────────────────────────
//  Browser Fingerprint
//  Lightweight, zero-dependency. Combines canvas render,
//  screen info, timezone, and platform into a SHA-256 hash.
// ─────────────────────────────────────────────────────

const FINGERPRINT_CACHE_KEY = "kalamio_fp";

async function generateFingerprint() {
    // Return cached fingerprint if available
    try {
        const cached = sessionStorage.getItem(FINGERPRINT_CACHE_KEY);
        if (cached) return cached;
    } catch {}

    try {
        const components = [];

        // Canvas fingerprint
        try {
            const canvas = document.createElement("canvas");
            canvas.width = 200;
            canvas.height = 50;
            const ctx = canvas.getContext("2d");
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.fillStyle = "#f60";
            ctx.fillRect(50, 0, 80, 30);
            ctx.fillStyle = "#069";
            ctx.fillText("Kalamio fp", 2, 15);
            ctx.fillStyle = "rgba(102,204,0,0.7)";
            ctx.fillText("Kalamio fp", 4, 17);
            components.push(canvas.toDataURL());
        } catch {
            components.push("no-canvas");
        }

        // Screen info
        components.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);

        // Timezone
        components.push(Intl.DateTimeFormat().resolvedOptions().timeZone || "");

        // Language & platform
        components.push(navigator.language || "");
        components.push(navigator.platform || "");

        // Hardware concurrency
        components.push(String(navigator.hardwareConcurrency || ""));

        const raw = components.join("|");

        // SHA-256 via Web Crypto API
        const encoder = new TextEncoder();
        const data = encoder.encode(raw);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fingerprint = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

        // Cache for this session
        try {
            sessionStorage.setItem(FINGERPRINT_CACHE_KEY, fingerprint);
        } catch {}

        return fingerprint;
    } catch {
        // Fallback: random ID (will still work, just less consistent for dedup)
        const fallback = "anon-" + Math.random().toString(36).substring(2) + Date.now().toString(36);
        try {
            sessionStorage.setItem(FINGERPRINT_CACHE_KEY, fallback);
        } catch {}
        return fallback;
    }
}


// ─────────────────────────────────────────────────────
//  useReadTracker Hook
//
//  Tracks genuine reading engagement via:
//  1. Scroll depth (must reach ≥ 50% of page)
//  2. Active time (visibility-aware, pauses in hidden tabs)
//  3. Fires exactly once per page session
//  4. All errors fail silently
// ─────────────────────────────────────────────────────

export default function useReadTracker({ blogId, readTime, authorId, isDraft, isEditMode }) {

    const { userAuth } = useContext(UserContext);
    const hasFired = useRef(false);
    const activeSeconds = useRef(0);
    const maxScrollDepth = useRef(0);
    const timerRef = useRef(null);
    const isVisible = useRef(true);
    const fingerprintRef = useRef(null);

    // Calculate time threshold based on article length
    // Short articles: 15s min, long articles: scale with readTime, cap at 300s
    const timeThreshold = Math.min(300, Math.max(15, (readTime || 1) * 12));

    const SCROLL_THRESHOLD = 50; // percentage

    const fireReadEvent = useCallback(async () => {
        if (hasFired.current) return;
        hasFired.current = true;

        try {
            const fingerprint = fingerprintRef.current || await generateFingerprint();

            await api.post("/record-read", {
                blog_id: blogId,
                fingerprint,
                scroll_depth: Math.round(maxScrollDepth.current),
                read_duration: Math.round(activeSeconds.current),
            });
        } catch {
            // Fail silently — never disrupt the reading experience
        }
    }, [blogId]);

    const checkAndFire = useCallback(() => {
        if (hasFired.current) return;
        if (activeSeconds.current >= timeThreshold && maxScrollDepth.current >= SCROLL_THRESHOLD) {
            fireReadEvent();
        }
    }, [timeThreshold, fireReadEvent]);

    useEffect(() => {
        // Don't track drafts, edit mode, or if already fired
        if (isDraft || isEditMode || !blogId) return;

        // Don't track if current user is the author
        if (userAuth?.access_token && userAuth?._id && authorId && userAuth._id === authorId) return;

        // Reset for new blog
        hasFired.current = false;
        activeSeconds.current = 0;
        maxScrollDepth.current = 0;

        // ── Fingerprint (async, best-effort) ──
        generateFingerprint().then(fp => {
            fingerprintRef.current = fp;
        }).catch(() => {});

        // ── Visibility-aware timer ──
        const handleVisibility = () => {
            isVisible.current = document.visibilityState === "visible";
        };
        document.addEventListener("visibilitychange", handleVisibility);
        isVisible.current = document.visibilityState === "visible";

        timerRef.current = setInterval(() => {
            if (!isVisible.current || hasFired.current) return;
            activeSeconds.current += 1;
            checkAndFire();
        }, 1000);

        // ── Scroll depth tracking (throttled) ──
        let scrollTicking = false;
        const handleScroll = () => {
            if (scrollTicking || hasFired.current) return;
            scrollTicking = true;

            requestAnimationFrame(() => {
                const scrollY = window.scrollY || window.pageYOffset;
                const windowHeight = window.innerHeight;
                const docHeight = document.documentElement.scrollHeight;

                if (docHeight > windowHeight) {
                    const scrollPercent = ((scrollY + windowHeight) / docHeight) * 100;
                    if (scrollPercent > maxScrollDepth.current) {
                        maxScrollDepth.current = scrollPercent;
                        checkAndFire();
                    }
                }

                scrollTicking = false;
            });
        };

        window.addEventListener("scroll", handleScroll, { passive: true });

        // ── Cleanup ──
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            document.removeEventListener("visibilitychange", handleVisibility);
            window.removeEventListener("scroll", handleScroll);
        };
    }, [blogId, isDraft, isEditMode, authorId, userAuth?.access_token, userAuth?._id, checkAndFire]);
}
