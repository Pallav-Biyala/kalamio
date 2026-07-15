import React, { useState, useCallback, useEffect, useRef } from 'react';
import Cropper from 'react-easy-crop';
import toast from 'react-hot-toast';
import { proxyImageUrl } from '../common/imageProxy';
import { isOwnedImageUrl } from '../common/cdn';
import Icon from './Icon';

// ─── Canvas utility: extract a rotated + cropped region as a JPEG Blob ───────

const loadImage = (url, { crossOrigin, referrerPolicy } = {}) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    if (crossOrigin) image.crossOrigin = crossOrigin;
    if (referrerPolicy) image.referrerPolicy = referrerPolicy;
    image.src = url;
  });

/**
 * Load an image ready for a canvas READ (crop/rotate export), CSP- and CORS-safe:
 *  - blob:/data: (fresh local uploads) → load directly (same-origin, never tainted).
 *  - Our S3/CDN images → fetch through the same-origin /image-proxy and load the resulting
 *    same-origin blob. (CSP connect-src allows the API host like any API call; img-src does NOT,
 *    so the proxy URL can't be an <img> src — but a fetch is fine. A same-origin blob never taints.)
 *  - Foreign hosts (Google/dicebear/…) → CSP img-src allows them but connect-src does NOT, so we
 *    can't fetch them; read via a crossOrigin <img> (their host sends CORS). no-referrer avoids
 *    hotlink 429s.
 */
const createImage = async (src) => {
  if (!/^https?:/i.test(src)) return loadImage(src); // blob:/data:

  if (isOwnedImageUrl(src)) {
    const resp = await fetch(proxyImageUrl(src), { mode: 'cors', cache: 'no-store' });
    if (!resp.ok) throw new Error(`Image fetch failed: ${resp.status}`);
    const objectUrl = URL.createObjectURL(await resp.blob());
    try {
      return await loadImage(objectUrl);
    } finally {
      URL.revokeObjectURL(objectUrl); // safe post-load: the decoded bitmap is retained
    }
  }

  return loadImage(src, { crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' });
};

function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Returns the new bounding-box dimensions after rotating an image.
 */
function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

/**
 * Draws the image onto a canvas with rotation applied, then extracts
 * the cropped area defined by `pixelCrop`. Returns a JPEG Blob.
 */
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await createImage(imageSrc); // fetched CORS-clean as a same-origin blob (see above)
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return null;

  const rotRad = getRadianAngle(rotation);

  // Compute bounding box of the rotated image
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  // Set canvas size to the bounding box so nothing is clipped
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // Translate to center → rotate → draw image centered
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.translate(-image.width / 2, -image.height / 2);
  ctx.drawImage(image, 0, 0);

  // Extract the cropped area
  const croppedCanvas = document.createElement('canvas');
  const croppedCtx = croppedCanvas.getContext('2d');

  if (!croppedCtx) return null;

  croppedCanvas.width = pixelCrop.width;
  croppedCanvas.height = pixelCrop.height;

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve) => {
    croppedCanvas.toBlob(
      (blob) => resolve(blob),
      'image/jpeg',
      0.92 // high quality
    );
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

const ImageCropperModal = ({ imageSrc, onComplete, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  // Clamp horizontal position to prevent subpixel drift at min zoom
  const handleCropChange = (newCrop) => {
    if (cropSize && zoom <= 1.01) {
      // At minimum zoom, lock horizontal movement entirely
      setCrop({ x: 0, y: newCrop.y });
    } else {
      setCrop(newCrop);
    }
  };
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imgObjectFit, setImgObjectFit] = useState('horizontal-cover');
  const [cropSize, setCropSize] = useState(null);
  const [applying, setApplying] = useState(false);
  const containerRef = useRef(null);

  // Measure container — circle fills full width so image edges touch circle edges
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const size = el.clientWidth;
      setCropSize({ width: size, height: size });
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Detect image orientation and set objectFit accordingly
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth <= img.naturalHeight) {
        setImgObjectFit('horizontal-cover');
      } else {
        setImgObjectFit('vertical-cover');
      }
    };
    img.referrerPolicy = 'no-referrer'; // don't leak Referer to Google (429 hotlink block)
    img.src = imageSrc;
  }, [imageSrc]);

  const onCropComplete = useCallback((_croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleRotateLeft = () => setRotation((prev) => prev - 90);
  const handleRotateRight = () => setRotation((prev) => prev + 90);
  const handleResetRotation = () => setRotation(0);

  const handleApply = async () => {
    if (!croppedAreaPixels || applying) return;
    setApplying(true);
    try {
      const croppedBlob = await getCroppedImg(
        imageSrc,
        croppedAreaPixels,
        rotation
      );
      if (!croppedBlob) throw new Error('Empty crop result');
      const file = new File([croppedBlob], 'cropped.jpeg', {
        type: 'image/jpeg',
      });
      onComplete(file); // unmounts the modal on success
    } catch (err) {
      // Most often a tainted/blocked cross-origin canvas — surface it instead of failing silently.
      console.error('Crop failed', err);
      toast.error("Couldn't process the image. Please try again.");
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: '#0C0A0A' }}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[480px] lg:max-w-[780px] overflow-hidden flex flex-col animate-fade-in"
        style={{ animation: 'cropperSlideUp 0.25s ease-out' }}
      >
        {/* ── Header (Mobile only) ─────────────────────── */}
        <div className="px-5 py-3 border-b border-grey/50 flex justify-between items-center lg:hidden">
          <p className="text-base font-semibold m-0">Edit image</p>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-grey/80 transition-colors"
          >
            <Icon name="close" className="text-dark-grey" />
          </button>
        </div>

        {/* ── Body: horizontal on lg, vertical on mobile ── */}
        <div className="flex flex-col lg:flex-row h-full">

          {/* ── Cropper area ─────────────────────────── */}
          <div ref={containerRef} className="relative w-full lg:w-[55%] bg-black flex-shrink-0" style={{ aspectRatio: '1/1' }}>
            {cropSize && (
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={1}
                cropShape="round"
                showGrid={true}
                onCropChange={handleCropChange}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                minZoom={1}
                maxZoom={5}
                zoomSpeed={0.3}
                restrictPosition={true}
                objectFit={imgObjectFit}
                cropSize={cropSize}
                mediaProps={{ referrerPolicy: 'no-referrer' }}
                style={{
                  cropAreaStyle: {
                    border: 'none',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                  },
                }}
              />
            )}
          </div>

          {/* ── Controls panel ────────────────────────── */}
          <div className="flex-1 px-5 py-4 flex flex-col gap-4 lg:justify-between">

            {/* Header (Desktop only) */}
            <div className="hidden lg:flex justify-between items-center pb-2 border-b border-grey/50">
              <p className="text-base font-semibold m-0">Edit image</p>
              <button
                type="button"
                onClick={onCancel}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-grey/80 transition-colors"
              >
                <Icon name="close" className="text-dark-grey" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {/* Zoom slider */}
              <div>
                <p className="text-xs text-dark-grey mb-1.5 hidden lg:block">Zoom</p>
                <div className="flex items-center gap-3">
                  <Icon name="zoom_out" className="text-dark-grey text-xl" />
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={5}
                    step={0.05}
                    aria-label="Zoom"
                    onChange={(e) => setZoom(Number(e.target.value))}
                    className="cropper-range flex-1"
                  />
                  <Icon name="zoom_in" className="text-dark-grey text-xl" />
                </div>
              </div>

              {/* Rotation slider */}
              <div>
                <p className="text-xs text-dark-grey mb-1.5 hidden lg:block">Rotation</p>
                <div className="flex items-center gap-3">
                  <Icon name="rotate_left" className="text-dark-grey text-xl" />
                  <input
                    type="range"
                    value={rotation}
                    min={-180}
                    max={180}
                    step={1}
                    aria-label="Rotation"
                    onChange={(e) => setRotation(Number(e.target.value))}
                    className="cropper-range flex-1"
                  />
                  <Icon name="rotate_right" className="text-dark-grey text-xl" />
                </div>
              </div>

              {/* Quick-action rotation buttons */}
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleRotateLeft}
                  className="p-2 rounded-full hover:bg-grey/80 transition-colors"
                  title="Rotate 90° left"
                >
                  <Icon name="rotate_left" className="text-dark-grey" />
                </button>
                <button
                  type="button"
                  onClick={handleResetRotation}
                  className="px-3 py-1 rounded-full text-sm text-dark-grey hover:bg-grey/80 transition-colors"
                  title="Reset rotation"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleRotateRight}
                  className="p-2 rounded-full hover:bg-grey/80 transition-colors"
                  title="Rotate 90° right"
                >
                  <Icon name="rotate_right" className="text-dark-grey" />
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-1 lg:mt-0">
              <button
                type="button"
                className="btn-light w-full !py-2.5"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-dark w-full !py-2.5"
                onClick={handleApply}
                disabled={applying || !croppedAreaPixels}
              >
                {applying ? 'Applying…' : 'Apply'}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Inline keyframes for the slide-up animation */}
      <style>{`
        @keyframes cropperSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .cropper-range {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 4px;
          background: #e0e0e0;
          outline: none;
          transition: background 0.2s;
        }
        .cropper-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #000;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
          transition: transform 0.15s;
        }
        .cropper-range::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
        .cropper-range::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: #000;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
};

export default ImageCropperModal;
