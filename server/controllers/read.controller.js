import crypto from "crypto";
import ReadEvent from "../Schema/ReadEvent.js";
import DailyReadStats from "../Schema/DailyReadStats.js";
import Post from "../Schema/Post.js";
import User from "../Schema/User.js";
import Publication from "../Schema/Publication.js";

// Bot User-Agent keywords (lowercase)
const BOT_KEYWORDS = [
    "bot", "crawl", "spider", "slurp", "mediapartners",
    "headless", "phantom", "puppeteer", "lighthouse",
    "prerender", "wget", "curl", "python-requests",
    "go-http-client", "java/", "apache-httpclient",
    "googlebot", "bingbot", "yandexbot", "baiduspider",
    "facebookexternalhit", "twitterbot", "linkedinbot",
    "whatsapp", "telegrambot", "discordbot",
];

// Minimum thresholds to filter accidental clicks / bots
const MIN_SCROLL_DEPTH = 30;
const MIN_READ_DURATION = 10; // seconds

// Dedup window: same user/fingerprint + blog within 24 hours = no new read
const DEDUP_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Hash an IP address with a salt. Never store raw IPs.
 */
function hashIP(ip) {
    const salt = process.env.JWT_ACCESS_SECRET || "kalamio-read-salt";
    return crypto.createHash("sha256").update(ip + salt).digest("hex");
}

/**
 * Check if a User-Agent looks like a bot.
 */
function isBot(userAgent) {
    if (!userAgent) return true; // No UA = suspicious
    const ua = userAgent.toLowerCase();
    return BOT_KEYWORDS.some(keyword => ua.includes(keyword));
}

/**
 * Get today's date at midnight UTC (for daily stats grouping).
 */
function getTodayUTC() {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * POST /record-read
 *
 * Records a validated, deduplicated read event.
 * Uses optionalJWT — works for both authenticated and anonymous users.
 */
export const recordRead = async (req, res) => {
    try {
        const { blog_id, fingerprint, scroll_depth, read_duration } = req.body;

        // ── 1. Basic validation ──
        if (!blog_id || !fingerprint) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const scrollNum = Number(scroll_depth) || 0;
        const durationNum = Number(read_duration) || 0;

        // ── 2. Minimum thresholds (filters bots & accidental clicks) ──
        if (scrollNum < MIN_SCROLL_DEPTH || durationNum < MIN_READ_DURATION) {
            return res.status(200).json({ counted: false, reason: "threshold" });
        }

        // ── 3. Bot detection via User-Agent ──
        const userAgent = req.headers["user-agent"] || "";
        if (isBot(userAgent)) {
            return res.status(200).json({ counted: false, reason: "bot" });
        }

        // ── 4. Look up the blog ──
        const blog = await Post.findOne({ blog_id })
            .select("_id author publication")
            .lean();

        if (!blog) {
            return res.status(404).json({ error: "Blog not found" });
        }

        // ── 5. Author exclusion ──
        const userId = req.user || null;
        if (userId && blog.author.toString() === userId.toString()) {
            return res.status(200).json({ counted: false, reason: "author" });
        }

        // ── 6. Dedup check ──
        const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS);
        let isDuplicate = false;

        if (userId) {
            // Logged-in user: dedup by (blog + user) in last 24h
            const existing = await ReadEvent.findOne({
                blog: blog._id,
                user: userId,
                created_at: { $gte: dedupCutoff },
            }).lean();
            isDuplicate = !!existing;
        } else {
            // Anonymous: dedup by (blog + fingerprint) in last 24h
            const existing = await ReadEvent.findOne({
                blog: blog._id,
                fingerprint,
                created_at: { $gte: dedupCutoff },
            }).lean();
            isDuplicate = !!existing;
        }

        if (isDuplicate) {
            return res.status(200).json({ counted: false, reason: "duplicate" });
        }

        // ── 7. Hash the IP ──
        const rawIP = req.headers["x-forwarded-for"]?.split(",")[0]?.trim()
            || req.connection?.remoteAddress
            || req.ip
            || "unknown";
        const ipHash = hashIP(rawIP);

        // ── 8. Record the read ──
        // Create the read event
        ReadEvent.create({
            blog: blog._id,
            user: userId,
            fingerprint,
            ip_hash: ipHash,
            user_agent: userAgent.substring(0, 500), // Cap UA length
            scroll_depth: Math.min(100, scrollNum),
            read_duration: Math.min(3600, durationNum), // Cap at 1 hour
        }).catch(err => console.error("ReadEvent create error:", err));

        // Increment Post total_reads
        Post.findByIdAndUpdate(blog._id, {
            $inc: { "activity.total_reads": 1 }
        }).catch(err => console.error("Post read increment error:", err));

        // Increment author's total_reads
        User.findByIdAndUpdate(blog.author, {
            $inc: { "account_info.total_reads": 1 }
        }).catch(err => console.error("User read increment error:", err));

        // Increment publication total_reads (if applicable)
        if (blog.publication) {
            Publication.findByIdAndUpdate(blog.publication, {
                $inc: { total_reads: 1 }
            }).catch(err => console.error("Publication read increment error:", err));
        }

        // Upsert daily stats
        const today = getTodayUTC();
        DailyReadStats.findOneAndUpdate(
            { blog: blog._id, date: today },
            {
                $inc: { reads: 1 },
                $setOnInsert: { blog: blog._id, author: blog.author, date: today },
            },
            { upsert: true, new: true }
        ).catch(err => console.error("DailyReadStats upsert error:", err));

        return res.status(201).json({ counted: true });

    } catch (err) {
        console.error("recordRead error:", err);
        // Fail silently for the client — don't break their experience
        return res.status(200).json({ counted: false, reason: "error" });
    }
};
