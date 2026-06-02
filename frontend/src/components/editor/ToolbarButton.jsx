import { memo } from 'react';
import Icon from '../Icon';

const ToolbarButton = memo(({ icon, label, onClick, isActive = false, isDisabled = false, className = '' }) => {
  return (
    <button
      type="button"
      className={`toolbar-btn ${isActive ? 'toolbar-btn--active' : ''} ${className}`}
      onClick={onClick}
      disabled={isDisabled}
      aria-label={label}
      data-tooltip={label}
    >
      <Icon name={icon} className="text-lg" />
    </button>
  );
});

ToolbarButton.displayName = 'ToolbarButton';

export default ToolbarButton;
