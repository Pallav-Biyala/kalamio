import Image from '@tiptap/extension-image';
import { ReactNodeViewRenderer } from '@tiptap/react';
import ImageNodeView from '../views/ImageNodeView';

/**
 * ImageWithCaption — Extends the stock Tiptap Image extension to add
 * a `caption` attribute and renders as <figure> with <figcaption>.
 *
 * Serializes to:
 *   <figure>
 *     <img src="..." alt="..." title="..." />
 *     <figcaption>caption text</figcaption>
 *   </figure>
 *
 * Parses from both <figure><img/><figcaption/></figure> and plain <img/>.
 */
const ImageWithCaption = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      caption: {
        default: '',
        parseHTML: (element) => {
          // If the element is a <figure>, look for <figcaption>
          if (element.tagName === 'FIGURE') {
            const figcaption = element.querySelector('figcaption');
            return figcaption ? figcaption.textContent : '';
          }
          // For bare <img>, try data-caption attribute
          return element.getAttribute('data-caption') || '';
        },
        renderHTML: (attributes) => {
          if (!attributes.caption) return {};
          return { 'data-caption': attributes.caption };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure',
        contentElement: 'figcaption',
        getAttrs: (element) => {
          const img = element.querySelector('img');
          if (!img) return false;
          return {
            src: img.getAttribute('src'),
            alt: img.getAttribute('alt') || '',
            title: img.getAttribute('title') || '',
          };
          // caption is extracted by the attribute's parseHTML above
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (element) => ({
          src: element.getAttribute('src'),
          alt: element.getAttribute('alt') || '',
          title: element.getAttribute('title') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { caption, ...imgAttrs } = HTMLAttributes;

    return [
      'figure',
      { class: 'image-figure' },
      ['img', imgAttrs],
      ['figcaption', {}, caption || ''],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },

  addCommands() {
    return {
      ...this.parent?.(),
      setImage:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: attrs.src,
              alt: attrs.alt || '',
              title: attrs.title || '',
              caption: attrs.caption || '',
            },
          });
        },
    };
  },
});

export default ImageWithCaption;
