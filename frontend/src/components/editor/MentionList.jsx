import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from 'react';
import { createRoot } from 'react-dom/client';
import tippy from 'tippy.js';
import Avatar from '../Avatar';
import api from '../../common/api';

const MentionList = forwardRef(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index) => {
      const user = items[index];
      if (user) {
        command({
          id: user.personal_info.username,
          label: user.personal_info.fullname,
        });
      }
    },
    [items, command]
  );

  const upHandler = useCallback(() => {
    setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
  }, [items.length]);

  const downHandler = useCallback(() => {
    setSelectedIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const enterHandler = useCallback(() => {
    selectItem(selectedIndex);
  }, [selectItem, selectedIndex]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  if (!items || items.length === 0) {
    return (
      <div className="mention-list">
        <div className="mention-list__empty">No users found</div>
      </div>
    );
  }

  return (
    <div className="mention-list" role="listbox">
      {items.map((user, index) => {
        const { username, fullname, profile_img } = user.personal_info;
        return (
          <button
            type="button"
            className={`mention-list__item ${
              index === selectedIndex ? 'mention-list__item--selected' : ''
            }`}
            key={username}
            onClick={() => selectItem(index)}
            role="option"
            aria-selected={index === selectedIndex}
          >
            <Avatar
              src={profile_img}
              alt={fullname}
              size={28}
            />
            <div className="mention-list__info">
              <span className="mention-list__fullname">{fullname}</span>
              <span className="mention-list__username">@{username}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
});

MentionList.displayName = 'MentionList';

export default MentionList;

/**
 * Mention suggestion configuration for Tiptap's Mention extension.
 * Uses tippy.js for positioning and React's createRoot for rendering.
 */
export const mentionSuggestionConfig = {
  items: async ({ query }) => {
    if (!query || query.length < 2) return [];
    try {
      const { data } = await api.post('/search-users', { query });
      return data.users || [];
    } catch {
      return [];
    }
  },

  render: () => {
    let component;
    let popup;
    let reactRoot;
    let containerEl;

    return {
      onStart: (props) => {
        containerEl = document.createElement('div');
        containerEl.className = 'mention-list-container';
        reactRoot = createRoot(containerEl);

        reactRoot.render(
          <MentionList
            ref={(ref) => {
              component = ref;
            }}
            items={props.items}
            command={props.command}
          />
        );

        if (!props.clientRect) return;

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: containerEl,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          animation: 'shift-toward-subtle',
          maxWidth: 320,
        });
      },

      onUpdate: (props) => {
        reactRoot?.render(
          <MentionList
            ref={(ref) => {
              component = ref;
            }}
            items={props.items}
            command={props.command}
          />
        );

        if (popup?.[0] && props.clientRect) {
          popup[0].setProps({
            getReferenceClientRect: props.clientRect,
          });
        }
      },

      onKeyDown: (props) => {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }
        return component?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.[0]?.destroy();
        // Defer unmount to avoid React warning about sync unmount during render
        setTimeout(() => {
          reactRoot?.unmount();
        }, 0);
      },
    };
  },
};
