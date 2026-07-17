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
    // The <img> inside a <figure> match, or the element itself for a bare <img>.
    const imgEl = (element) => (element.tagName === 'FIGURE' ? element.querySelector('img') : element);
    const intAttr = (name) => ({
      default: null,
      parseHTML: (element) => {
        const value = imgEl(element)?.getAttribute(name);
        const parsed = parseInt(value, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
      },
      renderHTML: (attributes) => (attributes[name] ? { [name]: attributes[name] } : {}),
    });

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
      // Intrinsic pixel size, recorded at upload. The reader emits these on the <img> so the
      // browser reserves the right box before the bytes arrive (no layout shift). Null on images
      // uploaded before this existed — the reader just omits the attributes then.
      width: intAttr('width'),
      height: intAttr('height'),
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

  renderHTML({ node, HTMLAttributes }) {
    // The caption attribute serializes itself to `data-caption` (see addAttributes), so there is no
    // `caption` key in HTMLAttributes — read the text from the node instead, and drop the stray
    // data-caption off the <img>. Otherwise the <figcaption> serializes empty and the caption is lost
    // on DOM serialization (e.g. copy/paste of the image node).
    const { 'data-caption': _dropCaption, ...imgAttrs } = HTMLAttributes;

    return [
      'figure',
      { class: 'image-figure' },
      ['img', imgAttrs],
      ['figcaption', {}, node.attrs.caption || ''],
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
              // Must be listed explicitly: this whitelist is what reaches the node, so anything
              // omitted here is silently dropped no matter what addAttributes declares.
              width: attrs.width || null,
              height: attrs.height || null,
            },
          });
        },
    };
  },
});

export default ImageWithCaption;
