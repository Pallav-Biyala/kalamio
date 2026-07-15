import { pipeline } from 'node:stream';
import { generateUploadURL, keyForOwnedUrl, getObjectStream } from '../config/s3.js';

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
];

// Get upload URL
export const getUploadUrl = (req, res) => {
    const { type } = req.query;

    if (!type || !ALLOWED_MIME_TYPES.includes(type)) {
        return res.status(400).json({ error: `Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` });
    }

    generateUploadURL(type)
    .then(url => res.status(200).json({ uploadURL: url }))
    .catch(err => {
        console.error('[Upload URL Error]', err.message);
        return res.status(500).json({ error: 'Failed to generate upload URL' });
    })
};

// Same-origin image proxy — streams one of OUR bucket images back through the API so its
// pixels can be read into a canvas (the profile-photo cropper). Our S3/CDN host doesn't return
// CORS headers, which taints the canvas and silently breaks crop/rotate export; the API's cors()
// middleware supplies them. SSRF-guarded to our own bucket via keyForOwnedUrl.
export const proxyImage = async (req, res) => {
    const key = keyForOwnedUrl(req.query.url);
    if (!key) {
        return res.status(400).json({ error: 'Invalid image url' });
    }

    let obj;
    try {
        obj = await getObjectStream(key);
    } catch (err) {
        console.error('[Image Proxy Error]', key, err.message);
        const status = err?.$metadata?.httpStatusCode;
        // Genuine missing key → 404; throttling / network / credential errors are retryable → 502.
        if (err.name === 'NoSuchKey' || err.name === 'NotFound' || status === 404) {
            return res.status(404).json({ error: 'Image not found' });
        }
        return res.status(502).json({ error: 'Upstream image fetch failed' });
    }

    res.set('Content-Type', obj.ContentType || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400'); // override the global no-store default

    // pipeline destroys BOTH streams on client abort / write error, so the S3 socket is released
    // back to the pool (a bare .pipe() would leak it on premature close).
    pipeline(obj.Body, res, (err) => {
        if (err) console.error('[Image Proxy] stream error:', err.message);
    });
};
