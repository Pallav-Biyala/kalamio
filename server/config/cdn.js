/**
 * Rewrite S3 image URLs → the Cloudflare-cached CDN host for server-rendered
 * social-unfurl tags (prerender's og:image / twitter:image / JSON-LD image).
 *
 * Host swap only — the object key (path) is identical on S3 and the CDN, so
 * `cdn.kalamio.com/<key>` resolves to the same object as S3.
 *
 * No-op until CDN_DOMAIN is set in the environment, so this is safe to ship before
 * the CDN subdomain exists. Non-S3 URLs (the default splash logo, etc.) pass through
 * untouched. Mirrors the frontend helper (frontend/src/common/cdn.js).
 */
const CDN_DOMAIN = (process.env.CDN_DOMAIN || '').replace(/\/+$/, '');
const S3_ORIGIN = `https://${process.env.AWS_BUCKET || 'blog-app-82817'}.s3.${process.env.AWS_REGION || 'ap-south-1'}.amazonaws.com`;

export const cdnUrl = (url) => {
  if (!CDN_DOMAIN || typeof url !== 'string' || !url.startsWith(S3_ORIGIN)) return url;
  return CDN_DOMAIN + url.slice(S3_ORIGIN.length);
};

export default cdnUrl;
