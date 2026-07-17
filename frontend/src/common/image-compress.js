/**
 * Downscale + re-encode images in the browser before they ever reach S3.
 *
 * Why this exists: a phone photo is ~4032x3024 and 8-12MB. Uploaded raw, those exact
 * bytes are what every reader downloads — on mobile data, for every image in the
 * article. Resizing to a sane display width and re-encoding to WebP typically cuts
 * that by ~95% with no visible difference at article width.
 *
 * Design rules:
 * - NEVER throw. Any failure returns the original file untouched; a slow upload beats
 *   a broken one.
 * - NEVER upscale. Small images pass through at their own size.
 * - NEVER touch GIFs — canvas only sees frame 1, so re-encoding silently destroys the
 *   animation.
 * - Keep the result only if it is actually smaller. Already-optimised images can grow
 *   when re-encoded, and shipping a bigger file would defeat the point.
 */

// Wide enough for a full-bleed image on a 2x display at the article's ~800px column,
// which is the largest an article image is ever rendered.
const MAX_DIMENSION = 2048;

// Photos. ~0.82 is the usual "can't tell the difference" knee: measured against the
// pristine source at the 800px column we actually render at, mean error is ~0.8% of a
// channel — invisible, at ~1/10th the bytes of lossless.
const QUALITY_PHOTO = 0.82;

// quality = 1 makes the canvas WebP encoder LOSSLESS (verified: byte-identical output).
// This matters for screenshots/diagrams: lossy ringing is obvious around small text and
// flat colour, and lossless WebP is still ~50% SMALLER than the source PNG. So graphics
// get perfect fidelity and a size win at the same time.
const QUALITY_LOSSLESS = 1;

// A photo exported as PNG encodes losslessly to megabytes. Past this we conclude it was a
// photo all along and re-encode it lossily (high quality) instead.
const LOSSLESS_MAX_BYTES = 1024 * 1024;
const QUALITY_GRAPHIC_FALLBACK = 0.9;

const OUTPUT_MIME = 'image/webp';

// Animation lives in frames a canvas can't see; re-encoding would freeze it. GIF is always
// treated as animated (a still GIF is rare and not worth a sniff). WebP and PNG are the common
// STILL formats but both have animated variants — animated WebP is what Giphy/Tenor hand you by
// default, and APNG ships as a plain `.png` — so those two are sniffed below rather than skipped
// wholesale, which would forfeit compression on the formats we most want to compress.
const SKIP_MIME_TYPES = new Set(['image/gif']);
const SNIFF_MIME_TYPES = new Set(['image/webp', 'image/png']);

// Both markers live in the header, far inside this window.
const ANIMATION_SNIFF_BYTES = 64 * 1024;

const readAscii = (bytes, offset, length = 4) =>
    String.fromCharCode(...bytes.subarray(offset, offset + length));

/** Animated WebP: RIFF/WEBP container whose VP8X chunk sets the ANIMATION flag (bit 0x02). */
const isAnimatedWebp = (bytes) => {
    if (bytes.length < 21) return false;
    if (readAscii(bytes, 0) !== 'RIFF' || readAscii(bytes, 8) !== 'WEBP') return false;
    if (readAscii(bytes, 12) !== 'VP8X') return false; // plain VP8/VP8L are always still
    return (bytes[20] & 0x02) !== 0;
};

/** APNG: a PNG whose chunk list contains `acTL` before the first `IDAT`. */
const isAnimatedPng = (bytes) => {
    const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 8 || SIGNATURE.some((b, i) => bytes[i] !== b)) return false;

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let offset = 8;
    while (offset + 8 <= bytes.length) {
        const length = view.getUint32(offset);
        const type = readAscii(bytes, offset + 4);
        if (type === 'acTL') return true;  // animation control chunk → APNG
        if (type === 'IDAT') return false; // acTL is required to precede IDAT
        const next = offset + 12 + length; // length + type + data + crc
        if (next <= offset) return false;  // malformed; don't spin
        offset = next;
    }
    return false;
};

const isAnimated = async (file) => {
    if (!SNIFF_MIME_TYPES.has(file.type)) return false;
    try {
        const bytes = new Uint8Array(await file.slice(0, ANIMATION_SNIFF_BYTES).arrayBuffer());
        return file.type === 'image/webp' ? isAnimatedWebp(bytes) : isAnimatedPng(bytes);
    } catch {
        return false; // Unreadable header — fall through; compression still fails safe.
    }
};

/** Does this browser actually encode WebP from a canvas? (Safari <14 did not.) */
const supportsWebpEncode = () => {
    try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        return canvas.toDataURL(OUTPUT_MIME).startsWith(`data:${OUTPUT_MIME}`);
    } catch {
        return false;
    }
};

/** Scale factor to fit within MAX_DIMENSION, never above 1 (no upscaling). */
const fitScale = (width, height) => Math.min(1, MAX_DIMENSION / Math.max(width, height));

const canvasToBlob = (canvas, mime, quality) =>
    new Promise((resolve) => {
        try {
            canvas.toBlob((blob) => resolve(blob), mime, quality);
        } catch {
            resolve(null);
        }
    });

/**
 * @param {File} file
 * @returns {Promise<{ file: File, width: number|null, height: number|null }>}
 *   The file to upload (compressed when that's a win, else the original) and its
 *   intrinsic pixel size. Width/height are null only if the image couldn't be decoded.
 */
export const compressImage = async (file) => {
    const unchanged = (width = null, height = null) => ({ file, width, height });

    if (!file || !file.type?.startsWith('image/')) return unchanged();
    if (SKIP_MIME_TYPES.has(file.type)) return unchanged();
    // Animated WebP/APNG: a canvas only ever sees frame 1, so re-encoding would upload a still
    // and the original frames would be gone for good.
    if (await isAnimated(file)) return unchanged();

    let bitmap;
    try {
        // `from-image` applies EXIF orientation, so a portrait phone photo doesn't come
        // out sideways once the EXIF is dropped by re-encoding.
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
        return unchanged(); // Undecodable here — let S3 take the original.
    }

    const { width: srcW, height: srcH } = bitmap;

    try {
        if (!supportsWebpEncode()) return unchanged(srcW, srcH);

        const scale = fitScale(srcW, srcH);
        const outW = Math.max(1, Math.round(srcW * scale));
        const outH = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = outW;
        canvas.height = outH;

        const ctx = canvas.getContext('2d');
        if (!ctx) return unchanged(srcW, srcH);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(bitmap, 0, 0, outW, outH);

        // PNG is what screenshots, diagrams, logos and anything with transparency arrive as —
        // exactly the content lossy compression mangles. JPEG is the photo format and is
        // already lossy, so a lossy re-encode costs nothing perceptible.
        const isGraphic = file.type === 'image/png';

        let blob;
        if (isGraphic) {
            blob = await canvasToBlob(canvas, OUTPUT_MIME, QUALITY_LOSSLESS);
            if (blob && blob.size > LOSSLESS_MAX_BYTES) {
                // Too big to be a real screenshot — treat it as the photo it evidently is.
                blob = (await canvasToBlob(canvas, OUTPUT_MIME, QUALITY_GRAPHIC_FALLBACK)) || blob;
            }
        } else {
            blob = await canvasToBlob(canvas, OUTPUT_MIME, QUALITY_PHOTO);
        }
        if (!blob) return unchanged(srcW, srcH);

        // Re-encoding can inflate an already-optimised source (a low-quality JPEG, a flat PNG).
        // Only ever take the win — never trade MORE bytes for FEWER pixels. This must not be
        // conditioned on scale: a downscaled-but-inflated result is the worst of both.
        if (blob.size >= file.size) return unchanged(srcW, srcH);

        const name = (file.name || 'image').replace(/\.[^.]+$/, '') + '.webp';
        const compressed = new File([blob], name, { type: OUTPUT_MIME, lastModified: Date.now() });

        return { file: compressed, width: outW, height: outH };
    } catch {
        return unchanged(srcW, srcH);
    } finally {
        bitmap.close?.();
    }
};

export const IMAGE_COMPRESSION = { MAX_DIMENSION, QUALITY_PHOTO, QUALITY_LOSSLESS, OUTPUT_MIME };
