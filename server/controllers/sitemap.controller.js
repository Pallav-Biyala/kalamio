import Post from '../Schema/Post.js';
import User from '../Schema/User.js';
import Publication from '../Schema/Publication.js';

/**
 * Dynamic sitemap.xml — lists every indexable URL (published posts, the
 * publications, and the profiles of authors who have published) so search
 * engines discover content that the client-rendered SPA wouldn't otherwise
 * expose. Referenced from public/robots.txt and served at /sitemap.xml (nginx
 * proxies that path here).
 */

const ORIGIN = (process.env.FRONTEND_URL || 'https://kalamio.com').replace(/\/+$/, '');

// sitemaps.org caps a single file at 50,000 URLs. These per-type limits keep us
// comfortably under that (+ the static home URL). Past this scale, split into a
// <sitemapindex> of per-type files — noted for the future.
const MAX_BLOGS = 45000;
const MAX_USERS = 4000;
const MAX_PUBLICATIONS = 900;

const xmlEscape = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toW3CDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const urlEntry = ({ loc, lastmod, changefreq, priority }) => {
  let entry = `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n`;
  if (lastmod) entry += `    <lastmod>${lastmod}</lastmod>\n`;
  if (changefreq) entry += `    <changefreq>${changefreq}</changefreq>\n`;
  if (priority != null) entry += `    <priority>${priority}</priority>\n`;
  entry += '  </url>\n';
  return entry;
};

/**
 * Pure builder — turn fetched entities into a sitemap XML string. Exported so it
 * can be unit-tested without a database.
 */
export const buildSitemap = ({ blogs = [], users = [], publications = [] } = {}) => {
  let body = urlEntry({ loc: `${ORIGIN}/`, changefreq: 'hourly', priority: '1.0' });

  for (const blog of blogs) {
    if (!blog?.blog_id) continue;
    body += urlEntry({
      loc: `${ORIGIN}/blog/${blog.blog_id}`,
      lastmod: toW3CDate(blog.updatedAt || blog.publishedAt),
      changefreq: 'weekly',
      priority: '0.8',
    });
  }

  for (const user of users) {
    const username = user?.personal_info?.username;
    if (!username) continue;
    body += urlEntry({
      loc: `${ORIGIN}/user/${username}`,
      lastmod: toW3CDate(user.updatedAt),
      changefreq: 'weekly',
      priority: '0.5',
    });
  }

  for (const pub of publications) {
    if (!pub?.slug) continue;
    body += urlEntry({
      loc: `${ORIGIN}/publication/${pub.slug}`,
      lastmod: toW3CDate(pub.updatedAt),
      changefreq: 'weekly',
      priority: '0.6',
    });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}</urlset>\n`;
};

export const sitemap = async (req, res) => {
  try {
    const [blogs, authorIds, publications] = await Promise.all([
      Post.find({ draft: false })
        .select('blog_id publishedAt updatedAt')
        .sort({ publishedAt: -1 })
        .limit(MAX_BLOGS)
        .lean(),
      Post.distinct('author', { draft: false }),
      Publication.find({})
        .select('slug updatedAt')
        .limit(MAX_PUBLICATIONS)
        .lean(),
    ]);

    const users = await User.find({ _id: { $in: authorIds } })
      .select('personal_info.username updatedAt')
      .limit(MAX_USERS)
      .lean();

    const xml = buildSitemap({ blogs, users, publications });
    res.set('Content-Type', 'application/xml; charset=utf-8');
    // 1h in the browser, 6h at the CDN — the sitemap doesn't need to be realtime.
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=21600');
    return res.status(200).send(xml);
  } catch {
    // Never 500 a crawler — serve a minimal but valid sitemap.
    res.set('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(buildSitemap({}));
  }
};
