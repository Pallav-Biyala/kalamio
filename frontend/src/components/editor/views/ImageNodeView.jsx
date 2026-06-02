import { memo, useCallback, useState } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import Icon from '../../Icon';

const ImageNodeView = memo(({ node, updateAttributes, deleteNode, selected }) => {
  const { src, alt, caption } = node.attrs;
  const [isHovered, setIsHovered] = useState(false);

  const handleCaptionChange = useCallback(
    (e) => {
      updateAttributes({ caption: e.target.value });
    },
    [updateAttributes]
  );

  const handleDelete = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteNode();
    },
    [deleteNode]
  );

  return (
    <NodeViewWrapper className="image-node-view" data-drag-handle="">
      <figure
        className={`image-node-view__figure ${selected ? 'image-node-view__figure--selected' : ''}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="image-node-view__img-wrapper">
          <img
            src={src}
            alt={alt || caption || ''}
            className="image-node-view__img"
            draggable={false}
          />
          {(isHovered || selected) && (
            <button
              type="button"
              className="image-node-view__delete"
              onClick={handleDelete}
              title="Remove image"
              aria-label="Remove image"
            >
              <Icon name="delete" className="text-base" />
            </button>
          )}
        </div>
        <input
          type="text"
          className="image-node-view__caption"
          placeholder="Add a caption..."
          value={caption || ''}
          onChange={handleCaptionChange}
          aria-label="Image caption"
        />
      </figure>
    </NodeViewWrapper>
  );
});

ImageNodeView.displayName = 'ImageNodeView';

export default ImageNodeView;
