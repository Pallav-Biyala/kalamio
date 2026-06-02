import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import FileAttachmentNodeView from '../views/FileAttachmentNodeView';

/**
 * FileAttachment — Custom Tiptap Node for file attachments.
 *
 * Stores file metadata (url, filename, fileSize, mimeType) and renders
 * as a block-level atom node via a React NodeView.
 *
 * Serializes to:
 *   <div data-file-attachment
 *        data-url="..."
 *        data-filename="..."
 *        data-file-size="..."
 *        data-mime-type="..." />
 */
const FileAttachment = Node.create({
  name: 'fileAttachment',

  group: 'block',

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') || '',
        renderHTML: (attributes) => ({ 'data-url': attributes.url }),
      },
      filename: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-filename') || '',
        renderHTML: (attributes) => ({ 'data-filename': attributes.filename }),
      },
      fileSize: {
        default: 0,
        parseHTML: (element) => {
          const raw = element.getAttribute('data-file-size');
          return raw ? Number(raw) : 0;
        },
        renderHTML: (attributes) => ({ 'data-file-size': String(attributes.fileSize) }),
      },
      mimeType: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-mime-type') || '',
        renderHTML: (attributes) => ({ 'data-mime-type': attributes.mimeType }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-file-attachment]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({ 'data-file-attachment': '' }, HTMLAttributes),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(FileAttachmentNodeView);
  },

  addCommands() {
    return {
      setFileAttachment:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              url: attrs.url || '',
              filename: attrs.filename || '',
              fileSize: attrs.fileSize || 0,
              mimeType: attrs.mimeType || '',
            },
          });
        },
    };
  },
});

export default FileAttachment;
