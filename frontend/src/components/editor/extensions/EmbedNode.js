import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import EmbedNodeView from '../views/EmbedNodeView';
import { MAX_EMBEDS } from './embed-registry';

/**
 * EmbedNode — Custom Tiptap Node for generic third-party embeds.
 *
 * Supports YouTube, Twitter/X, Spotify, Loom, CodePen, Figma,
 * Instagram, LinkedIn, Reddit, TikTok, Threads, Facebook,
 * GitHub Gist, and GitHub Repo embeds.
 *
 * Enforces a maximum of MAX_EMBEDS embed nodes (including YouTube
 * extension nodes) per document.
 */
const EmbedNode = Node.create({
  name: 'embed',

  group: 'block',

  atom: true,

  draggable: true,

  selectable: true,

  addAttributes() {
    return {
      provider: {
        default: null,
      },
      url: {
        default: '',
      },
      embedId: {
        default: '',
      },
      metadata: {
        default: {},
        parseHTML: (element) => {
          const raw = element.getAttribute('data-metadata');
          if (!raw) return {};
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        },
        renderHTML: (attributes) => {
          if (!attributes.metadata || Object.keys(attributes.metadata).length === 0) {
            return {};
          }
          return { 'data-metadata': JSON.stringify(attributes.metadata) };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-embed]',
        getAttrs: (element) => ({
          provider: element.getAttribute('data-provider'),
          url: element.getAttribute('data-url'),
          embedId: element.getAttribute('data-embed-id') || '',
        }),
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(
        {
          'data-embed': '',
          'data-provider': HTMLAttributes.provider || '',
          'data-url': HTMLAttributes.url || '',
          'data-embed-id': HTMLAttributes.embedId || '',
        },
        HTMLAttributes
      ),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedNodeView);
  },

  addCommands() {
    return {
      setEmbed:
        (attrs) =>
        ({ commands, state }) => {
          // Count existing embed + youtube nodes in the document
          let embedCount = 0;
          state.doc.descendants((node) => {
            if (node.type.name === 'embed' || node.type.name === 'youtube') {
              embedCount++;
            }
          });

          if (embedCount >= MAX_EMBEDS) {
            // Limit reached — do not insert
            return false;
          }

          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
    };
  },
});

export default EmbedNode;
