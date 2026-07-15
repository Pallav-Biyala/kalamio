import api from "./api";
import { isOwnedImageUrl } from "./cdn";

/**
 * Route one of OUR remote images through the same-origin API image proxy so its pixels can be
 * read into a canvas (the profile-photo cropper). Our S3/CDN host returns no CORS headers, which
 * taints the canvas and makes crop/rotate export fail silently; the API proxy supplies them.
 *
 * Only OUR bucket/CDN images are proxied (the server SSRF-rejects anything else). Foreign hosts
 * (Google OAuth avatars on googleusercontent, dicebear, etc.) send their own CORS, so they load
 * directly. blob:/data: URLs (fresh local uploads) are already same-origin and pass through too.
 */
export const proxyImageUrl = (url) => {
    if (typeof url !== "string" || !/^https?:/i.test(url)) return url; // blob:/data: → direct
    if (!isOwnedImageUrl(url)) return url;                             // foreign host → direct
    return `${api.defaults.baseURL}/image-proxy?url=${encodeURIComponent(url)}`;
};

export default proxyImageUrl;
