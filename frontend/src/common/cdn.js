// Route S3 image URLs through the Cloudflare-cached CDN domain instead of hitting
// the S3 origin (ap-south-1 / Mumbai) directly, so images are edge-cached near the
// viewer. This rewrites the HOST only — the object key (path) is identical on S3 and
// the CDN, so `cdn.kalamio.com/<key>` resolves to the same object as S3.
//
// Design notes:
// - No-op until VITE_CDN_DOMAIN is set at build time, so this is safe to ship BEFORE
//   the CDN subdomain exists (images just keep loading straight from S3).
// - Applied at RENDER time, never on stored data. The DB keeps canonical S3 URLs and
//   edit/save flows never persist a CDN host (which would couple data to the CDN and
//   dodge the backend's amazonaws.com-based image cleanup).
// - Leaves non-S3 URLs (dicebear, googleusercontent, data:) untouched.

const CDN_DOMAIN = import.meta.env.VITE_CDN_DOMAIN;            // e.g. "https://cdn.kalamio.com"
const S3_ORIGIN = 'https://blog-app-82817.s3.ap-south-1.amazonaws.com';

export const cdnUrl = (url) => {
  if (!CDN_DOMAIN || typeof url !== 'string' || !url.startsWith(S3_ORIGIN)) return url;
  return CDN_DOMAIN.replace(/\/$/, '') + url.slice(S3_ORIGIN.length);
};

export default cdnUrl;
