/**
 * URL Metadata Controller
 *
 * Server-side fetcher for OpenGraph / meta tags.
 * Special handling for platforms that block scraping (e.g. GitHub API).
 */

// ── GitHub API (no auth needed for public data) ──────────────────────
async function fetchGitHubMeta(url) {
    const profileMatch = url.match(/github\.com\/([a-zA-Z0-9_.-]+)\/?$/);
    const repoMatch = url.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/);

    if (repoMatch) {
        const [, owner, repo] = repoMatch;
        const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Kalamio/1.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            title: data.full_name,
            description: data.description || '',
            image: data.owner?.avatar_url || '',
            siteName: 'GitHub',
        };
    }

    if (profileMatch) {
        const [, username] = profileMatch;
        const res = await fetch(`https://api.github.com/users/${username}`, {
            headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Kalamio/1.0' },
        });
        if (!res.ok) return null;
        const data = await res.json();
        return {
            title: data.name || data.login,
            description: data.bio || `${data.public_repos} repositories · ${data.followers} followers`,
            image: data.avatar_url || '',
            siteName: 'GitHub',
        };
    }

    return null;
}

// ── Generic OG tag extraction ────────────────────────────────────────
const OG_RE = /<meta\s+(?:[^>]*?\s)?(?:property|name)\s*=\s*["']?(og:[^"'\s>]+|twitter:[^"'\s>]+|description)["']?\s+(?:[^>]*?\s)?content\s*=\s*["']([^"']*)["'][^>]*>/gi;
const OG_RE_ALT = /<meta\s+(?:[^>]*?\s)?content\s*=\s*["']([^"']*)["']\s+(?:[^>]*?\s)?(?:property|name)\s*=\s*["']?(og:[^"'\s>]+|twitter:[^"'\s>]+|description)["']?[^>]*>/gi;
const TITLE_RE = /<title[^>]*>([^<]*)<\/title>/i;

function extractMeta(html) {
    const meta = {};
    const titleMatch = html.match(TITLE_RE);
    if (titleMatch) meta._title = titleMatch[1].trim();

    let m;
    while ((m = OG_RE.exec(html)) !== null) meta[m[1].toLowerCase()] = m[2];
    while ((m = OG_RE_ALT.exec(html)) !== null) meta[m[2].toLowerCase()] = m[1];

    return {
        title: meta['og:title'] || meta['twitter:title'] || meta._title || '',
        description: meta['og:description'] || meta['twitter:description'] || meta['description'] || '',
        image: meta['og:image'] || meta['twitter:image'] || '',
        siteName: meta['og:site_name'] || '',
    };
}

async function fetchGenericMeta(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
        signal: controller.signal,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'identity',
        },
        redirect: 'follow',
    });
    clearTimeout(timeout);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let html = '';
    while (html.length < 150_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    const meta = extractMeta(html);
    return (meta.title || meta.description || meta.image) ? meta : null;
}

export const fetchUrlMetadata = async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'url is required' });
    }

    try {
        let meta = null;

        // Try platform-specific APIs first
        if (url.includes('github.com')) {
            meta = await fetchGitHubMeta(url);
        }

        // Fall back to generic OG scraping (won't work for LinkedIn, but works for many sites)
        if (!meta) {
            meta = await fetchGenericMeta(url).catch(() => null);
        }

        if (!meta) {
            return res.json({ title: '', description: '', image: '', siteName: '' });
        }

        res.set('Cache-Control', 'public, max-age=3600');
        return res.json(meta);
    } catch (err) {
        console.error('[metadata] Error for', url, ':', err.message);
        return res.json({ title: '', description: '', image: '', siteName: '' });
    }
};
