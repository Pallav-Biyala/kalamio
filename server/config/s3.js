import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { nanoid } from 'nanoid';

const BUCKET = process.env.AWS_BUCKET || 'blog-app-82817';
const REGION = process.env.AWS_REGION || 'ap-south-1';
const S3_ORIGIN = `https://${BUCKET}.s3.${REGION}.amazonaws.com`;
const CDN_DOMAIN = (process.env.CDN_DOMAIN || '').replace(/\/+$/, '');

// AWS SDK v3 — modular client (replaces deprecated aws-sdk v2)
const s3 = new S3Client({
    region: REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB max upload size

export const generateUploadURL = async (mimeType = 'image/jpeg') => {
    const date = new Date();
    // Safely extract extension from mime type (e.g. "image/png" -> "png")
    const ext = mimeType.split('/')[1] || 'jpeg';
    const imageName = `${nanoid()}-${date.getTime()}.${ext}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: imageName,
        ContentType: mimeType,
        // The key is unique per upload (nanoid + timestamp), so the bytes at this URL
        // never change → cache for a year and skip revalidation entirely. This is
        // SIGNED into the presigned URL, so the client's PUT MUST send a matching
        // `Cache-Control` header (see frontend common/aws.jsx) or S3 returns 403.
        CacheControl: 'public, max-age=31536000, immutable',
    });

    return await getSignedUrl(s3, command, {
        expiresIn: 1000,
        // Enforce max file size at S3 level to prevent storage abuse
        signableHeaders: new Set(['content-length']),
    });
};

/**
 * Extracts the S3 object key from a full S3 URL.
 * e.g. "https://blog-app-82817.s3.ap-south-1.amazonaws.com/abc123.jpeg" → "abc123.jpeg"
 */
const extractKeyFromUrl = (url) => {
    try {
        const parsed = new URL(url);
        // Remove leading slash from pathname
        return decodeURIComponent(parsed.pathname.slice(1));
    } catch {
        return null;
    }
};

/**
 * SSRF guard for the image proxy: return the object key ONLY if `url` points at our own
 * bucket (raw S3 origin or the CDN host that fronts it), else null. Prevents the proxy from
 * being coerced into fetching arbitrary URLs.
 */
export const keyForOwnedUrl = (url) => {
    if (typeof url !== 'string') return null;
    const owned = url.startsWith(S3_ORIGIN) || (CDN_DOMAIN && url.startsWith(CDN_DOMAIN));
    return owned ? extractKeyFromUrl(url) : null;
};

/**
 * Fetch an object from our bucket as a stream, for the same-origin image proxy.
 * Response carries `.Body` (a Node Readable) and `.ContentType`.
 */
export const getObjectStream = (key) =>
    s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));

/**
 * Deletes a single image from S3 by its full URL.
 * Silently logs errors (non-blocking — blog deletion should succeed even if S3 cleanup fails).
 */
export const deleteFromS3 = async (imageUrl) => {
    const key = extractKeyFromUrl(imageUrl);
    if (!key) return;

    try {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
        console.log(`🗑️  S3 deleted: ${key}`);
    } catch (err) {
        console.error(`⚠️  S3 delete failed for ${key}:`, err.message);
    }
};

/**
 * Deletes multiple images from S3 in a single batch request.
 * Accepts an array of full S3 URLs.
 */
export const deleteMultipleFromS3 = async (imageUrls) => {
    const keys = imageUrls
        .map(extractKeyFromUrl)
        .filter(Boolean);

    if (keys.length === 0) return;

    try {
        await s3.send(new DeleteObjectsCommand({
            Bucket: BUCKET,
            Delete: {
                Objects: keys.map(Key => ({ Key })),
                Quiet: true,
            },
        }));
        console.log(`🗑️  S3 batch deleted ${keys.length} image(s)`);
    } catch (err) {
        console.error(`⚠️  S3 batch delete failed:`, err.message);
    }
};
