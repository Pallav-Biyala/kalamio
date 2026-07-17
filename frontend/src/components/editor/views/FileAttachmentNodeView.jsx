import { memo, useCallback, useMemo } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import Icon from '../../Icon';

/**
 * Format bytes into a human-readable file size string.
 */
const formatFileSize = (bytes) => {
  if (bytes == null || isNaN(bytes)) return 'Unknown size';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const size = bytes / Math.pow(k, i);

  return `${size % 1 === 0 ? size : size.toFixed(1)} ${units[i]}`;
};

/**
 * Get an appropriate Material Symbol icon name based on MIME type.
 */
const getFileIcon = (fileType) => {
  if (!fileType) return 'insert_drive_file';

  if (fileType.startsWith('image/')) return 'image';
  if (fileType.startsWith('video/')) return 'movie';
  if (fileType.startsWith('audio/')) return 'audio_file';

  // Documents
  if (
    fileType.includes('pdf') ||
    fileType.includes('word') ||
    fileType.includes('document') ||
    fileType.includes('msword')
  ) {
    return 'description';
  }

  // Spreadsheets
  if (
    fileType.includes('sheet') ||
    fileType.includes('excel') ||
    fileType.includes('csv')
  ) {
    return 'table_chart';
  }

  // Presentations
  if (
    fileType.includes('presentation') ||
    fileType.includes('powerpoint') ||
    fileType.includes('slide')
  ) {
    return 'slideshow';
  }

  // Archives
  if (
    fileType.includes('zip') ||
    fileType.includes('rar') ||
    fileType.includes('tar') ||
    fileType.includes('7z') ||
    fileType.includes('gzip') ||
    fileType.includes('compressed')
  ) {
    return 'folder_zip';
  }

  // Code / text
  if (
    fileType.includes('text') ||
    fileType.includes('json') ||
    fileType.includes('xml') ||
    fileType.includes('javascript') ||
    fileType.includes('html') ||
    fileType.includes('css')
  ) {
    return 'article';
  }

  return 'insert_drive_file';
};

const FileAttachmentNodeView = memo(({ node, deleteNode }) => {
  const { url, filename, fileSize, mimeType } = node.attrs;
  const icon = useMemo(() => getFileIcon(mimeType), [mimeType]);
  const formattedSize = useMemo(() => formatFileSize(fileSize), [fileSize]);

  const handleDelete = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteNode();
    },
    [deleteNode]
  );

  const handleDownload = useCallback(() => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }, [url]);

  return (
    <NodeViewWrapper className="file-attachment-node-view" data-drag-handle="">
      <div className="file-attachment-node-view__card">
        <button
          type="button"
          className="file-attachment-node-view__main"
          onClick={handleDownload}
          title={`Download ${filename || 'file'}`}
        >
          <div className="file-attachment-node-view__icon">
            <Icon name={icon} className="text-2xl" />
          </div>
          <div className="file-attachment-node-view__info">
            <span className="file-attachment-node-view__name">
              {filename || 'Untitled file'}
            </span>
            <span className="file-attachment-node-view__size">
              {formattedSize}
            </span>
          </div>
        </button>
        <button
          type="button"
          className="file-attachment-node-view__remove"
          onClick={handleDelete}
          title="Remove attachment"
          aria-label="Remove attachment"
        >
          <Icon name="close" className="text-base" />
        </button>
      </div>
    </NodeViewWrapper>
  );
});

FileAttachmentNodeView.displayName = 'FileAttachmentNodeView';

export default FileAttachmentNodeView;
