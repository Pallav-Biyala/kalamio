/**
 * Drag-and-drop helpers for image upload areas (the blog banner).
 */

/** True when a drag carries files (not text or a link), so the drop zone only reacts to those. */
export const dragHasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');

/**
 * The first image among the dropped files, or null. `rejected` tells the caller that files WERE
 * dropped but none was an image, so it can explain why nothing happened.
 * @returns {{ file: File | null, rejected: boolean }}
 */
export const pickDroppedImage = (dataTransfer) => {
    const files = Array.from(dataTransfer?.files || []);
    const file = files.find(f => f.type.startsWith('image/')) || null;
    return { file, rejected: !file && files.length > 0 };
};
