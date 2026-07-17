import axios from "axios";
import api from "./api";
import { compressImage } from "./image-compress";

/**
 * Upload an image to S3, downscaling/re-encoding it first (see common/image-compress).
 *
 * @param {File} img
 * @returns {Promise<{ url: string, width: number|null, height: number|null }>}
 *   `width`/`height` are the intrinsic size of what was actually stored — callers that
 *   render the image should persist them so the reader can reserve the box up front.
 */
export const uploadImageWithMeta = async (img, { compress = true } = {}) => {

    // Compress BEFORE asking for the URL: the backend signs Content-Type into the
    // presigned URL and derives the object's extension from it, so the URL has to be
    // minted for the file we actually send (e.g. image/webp), not the original.
    const { file, width, height } = compress
        ? await compressImage(img)
        : { file: img, width: null, height: null };

    const { data: { uploadURL } } = await api.get(`/get-upload-url?type=${encodeURIComponent(file.type)}`);

    // Use raw axios for S3 — NOT the `api` instance,
    // because the interceptor adds a JWT Authorization header
    // that conflicts with S3's presigned URL authentication.
    await axios({
        method: 'PUT',
        url: uploadURL,
        headers: {
            'Content-Type': file.type,
            // Must EXACTLY match the CacheControl signed into the presigned URL by
            // the backend (config/s3.js), or S3 rejects with 403 SignatureDoesNotMatch.
            // Unique filenames make each object immutable → cache for a year.
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
        data: file
    });

    return { url: uploadURL.split("?")[0], width, height };

}

/**
 * Upload an image and return just its URL.
 * The long-standing signature — most callers (banners, avatars, publication logos) only
 * need the URL and get the compression for free.
 *
 * @param {File} img
 * @returns {Promise<string>}
 */
export const uploadImage = async (img) => (await uploadImageWithMeta(img)).url;

/**
 * Upload a file byte-for-byte, with no re-encoding.
 *
 * For attachments, where the stored object IS the user's file: the card records the
 * original filename/mimeType/size, so silently re-encoding a .png to .webp would leave
 * that metadata describing a file that no longer exists.
 *
 * @param {File} file
 * @returns {Promise<string>}
 */
export const uploadFileRaw = async (file) => (await uploadImageWithMeta(file, { compress: false })).url;
