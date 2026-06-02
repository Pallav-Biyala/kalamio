/**
 * Embed Registry — URL pattern → provider mapping
 *
 * Detects embeddable URLs, extracts IDs, and builds iframe embed URLs
 * for supported providers.
 */

export const MAX_EMBEDS = 5;

/**
 * Each provider entry contains:
 *  - regex:      RegExp to test a URL
 *  - extractId:  (url: string) => string | null
 *  - icon:       Material Symbols icon name
 *  - label:      Human-readable label
 *  - embedUrl:   (id: string) => string | null  (null if no iframe embed)
 */
export const EMBED_PROVIDERS = {
  // ─── P1 ────────────────────────────────────────────────────────────────
  youtube: {
    regex: /(?:youtube\.com\/(?:watch\?.*v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'smart_display',
    label: 'YouTube',
    embedUrl(id) {
      return `https://www.youtube.com/embed/${id}`;
    },
  },

  twitter: {
    regex: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)(?:\/status\/(\d+))?/,
    extractId(url) {
      const m = url.match(this.regex);
      if (!m) return null;
      // If it's a tweet URL, return the status ID
      if (m[2]) return m[2];
      // If it's a profile URL, return the username
      // Exclude known non-profile paths
      const nonProfilePaths = ['home', 'explore', 'search', 'settings', 'i', 'messages', 'notifications'];
      if (nonProfilePaths.includes(m[1])) return null;
      return m[1];
    },
    icon: 'tag',
    label: 'Twitter / X',
    embedUrl() {
      return null;
    },
  },

  'github-gist': {
    regex: /gist\.github\.com\/([a-zA-Z0-9_-]+)\/([a-f0-9]+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[2] : null;
    },
    icon: 'code',
    label: 'GitHub Gist',
    embedUrl() {
      return null;
    },
  },

  'github-repo': {
    regex: /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/,
    extractId(url) {
      // Exclude gist.github.com
      if (/gist\.github\.com/.test(url)) return null;
      const m = url.match(this.regex);
      return m ? `${m[1]}/${m[2]}` : null;
    },
    icon: 'folder_open',
    label: 'GitHub Repo',
    embedUrl() {
      return null;
    },
  },

  'github-profile': {
    // Matches github.com/username with NO second path segment (to avoid
    // colliding with github-repo which requires username/repo).
    regex: /^https?:\/\/github\.com\/([a-zA-Z0-9_.-]+)\/?$/,
    extractId(url) {
      if (/gist\.github\.com/.test(url)) return null;
      const m = url.match(this.regex);
      if (!m) return null;
      // Exclude known non-profile paths
      const reserved = ['features', 'enterprise', 'pricing', 'login', 'join', 'settings', 'explore', 'topics', 'collections', 'trending', 'events', 'marketplace', 'sponsors', 'notifications', 'new', 'organizations', 'about', 'security', 'customer-stories'];
      if (reserved.includes(m[1].toLowerCase())) return null;
      return m[1];
    },
    icon: 'person',
    label: 'GitHub Profile',
    embedUrl() {
      return null;
    },
  },

  spotify: {
    regex: /open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? `${m[1]}/${m[2]}` : null;
    },
    icon: 'music_note',
    label: 'Spotify',
    embedUrl(id) {
      // id is "track/abc123" or "album/xyz456"
      return `https://open.spotify.com/embed/${id}`;
    },
  },

  loom: {
    regex: /loom\.com\/share\/([a-f0-9]+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'videocam',
    label: 'Loom',
    embedUrl(id) {
      return `https://www.loom.com/embed/${id}`;
    },
  },

  // ─── P2 ────────────────────────────────────────────────────────────────
  // Content URL — /p/ or /reel/
  instagram: {
    regex: /instagram\.com\/(?:p|reel)\/([a-zA-Z0-9_-]+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'photo_camera',
    label: 'Instagram',
    embedUrl() {
      return null;
    },
  },

  // Profile URL — instagram.com/username
  'instagram-profile': {
    regex: /^https?:\/\/(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?(?:\?.*)?$/,
    extractId(url) {
      const m = url.match(this.regex);
      if (!m) return null;
      // Exclude known non-profile paths
      const reserved = ['p', 'reel', 'reels', 'stories', 'explore', 'accounts', 'directory', 'about', 'legal', 'developer'];
      if (reserved.includes(m[1].toLowerCase())) return null;
      return m[1];
    },
    icon: 'person',
    label: 'Instagram Profile',
    embedUrl() {
      return null;
    },
  },

  // Content URL — /posts/ or /feed/update/
  linkedin: {
    regex: /linkedin\.com\/(?:posts\/[a-zA-Z0-9_-]+-(\d+)|feed\/update\/urn:li:activity:(\d+))/,
    extractId(url) {
      const m = url.match(this.regex);
      if (!m) return null;
      return m[1] || m[2] || null;
    },
    icon: 'work',
    label: 'LinkedIn',
    embedUrl() {
      return null;
    },
  },

  // Profile URL — linkedin.com/in/username
  'linkedin-profile': {
    regex: /^https?:\/\/(?:www\.)?linkedin\.com\/in\/([a-zA-Z0-9_-]+)\/?(?:\?.*)?$/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'person',
    label: 'LinkedIn Profile',
    embedUrl() {
      return null;
    },
  },

  // Company page URL — linkedin.com/company/name
  'linkedin-company': {
    regex: /^https?:\/\/(?:www\.)?linkedin\.com\/company\/([a-zA-Z0-9_-]+)\/?(?:\?.*)?$/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'business',
    label: 'LinkedIn Company',
    embedUrl() {
      return null;
    },
  },

  // Content URL — /r/sub/comments/id
  reddit: {
    regex: /reddit\.com\/r\/([a-zA-Z0-9_]+)\/comments\/([a-z0-9]+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[2] : null;
    },
    icon: 'forum',
    label: 'Reddit',
    embedUrl() {
      return null;
    },
  },

  // Subreddit URL — reddit.com/r/subreddit (no /comments/)
  'reddit-subreddit': {
    regex: /^https?:\/\/(?:www\.)?reddit\.com\/r\/([a-zA-Z0-9_]+)\/?(?:\?.*)?$/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'group',
    label: 'Reddit Subreddit',
    embedUrl() {
      return null;
    },
  },

  codepen: {
    regex: /codepen\.io\/([a-zA-Z0-9_-]+)\/pen\/([a-zA-Z0-9]+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? `${m[1]}/${m[2]}` : null;
    },
    icon: 'code_blocks',
    label: 'CodePen',
    embedUrl(id) {
      // id is "user/penId"
      const [user, penId] = id.split('/');
      return `https://codepen.io/${user}/embed/${penId}?default-tab=result`;
    },
  },

  figma: {
    regex: /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)\/?/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'design_services',
    label: 'Figma',
    embedUrl(id) {
      // Figma uses the full URL in its embed iframe
      return `https://www.figma.com/embed?embed_host=share&url=https://www.figma.com/file/${id}`;
    },
  },

  // ─── P3 ────────────────────────────────────────────────────────────────
  // Content URL — /@user/video/id
  tiktok: {
    regex: /tiktok\.com\/@([a-zA-Z0-9_.]+)\/video\/(\d+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[2] : null;
    },
    icon: 'movie',
    label: 'TikTok',
    embedUrl() {
      return null;
    },
  },

  // Profile URL — tiktok.com/@username (no /video/)
  'tiktok-profile': {
    regex: /^https?:\/\/(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)\/?(?:\?.*)?$/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'person',
    label: 'TikTok Profile',
    embedUrl() {
      return null;
    },
  },

  // Content URL — /@user/post/id
  threads: {
    regex: /threads\.net\/@([a-zA-Z0-9_.]+)\/post\/([a-zA-Z0-9_-]+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[2] : null;
    },
    icon: 'chat',
    label: 'Threads',
    embedUrl() {
      return null;
    },
  },

  // Profile URL — threads.net/@username (no /post/)
  'threads-profile': {
    regex: /^https?:\/\/(?:www\.)?threads\.net\/@([a-zA-Z0-9_.]+)\/?(?:\?.*)?$/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[1] : null;
    },
    icon: 'person',
    label: 'Threads Profile',
    embedUrl() {
      return null;
    },
  },

  facebook: {
    regex: /facebook\.com\/([a-zA-Z0-9.]+)\/posts\/([a-zA-Z0-9_]+)/,
    extractId(url) {
      const m = url.match(this.regex);
      return m ? m[2] : null;
    },
    icon: 'public',
    label: 'Facebook',
    embedUrl() {
      return null;
    },
  },
};

/**
 * Attempt to detect the embed provider for a given URL.
 *
 * @param {string} url - The URL to test
 * @returns {{ provider: string, embedId: string, url: string } | null}
 */
export function detectEmbed(url) {
  if (!url || typeof url !== 'string') return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  // Order matters: content-specific patterns MUST come before their
  // profile/page counterparts so a post URL is never misidentified
  // as a profile. For GitHub: gist > repo > profile.
  const orderedKeys = [
    'youtube',
    'twitter',
    'github-gist',
    'github-repo',
    'github-profile',
    'spotify',
    'loom',
    'instagram',
    'instagram-profile',
    'linkedin',
    'linkedin-profile',
    'linkedin-company',
    'reddit',
    'reddit-subreddit',
    'codepen',
    'figma',
    'tiktok',
    'tiktok-profile',
    'threads',
    'threads-profile',
    'facebook',
  ];

  for (const key of orderedKeys) {
    const provider = EMBED_PROVIDERS[key];
    if (provider.regex.test(trimmed)) {
      const embedId = provider.extractId(trimmed);
      if (embedId) {
        return { provider: key, embedId, url: trimmed };
      }
    }
  }

  return null;
}

/**
 * Build the iframe embed URL for providers that support it.
 *
 * @param {string} provider - Provider key (e.g. 'youtube', 'spotify')
 * @param {string} embedId  - The extracted embed ID
 * @returns {string | null}  The embed URL, or null if not supported
 */
export function getEmbedUrl(provider, embedId) {
  const entry = EMBED_PROVIDERS[provider];
  if (!entry || typeof entry.embedUrl !== 'function') return null;
  return entry.embedUrl(embedId);
}
