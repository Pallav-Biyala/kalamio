const Icon = ({ name, className = "", filled = false, ariaLabel = "", onClick = null, style = {} }) => {
    return (
        <span
            className={`material-symbols-rounded ${filled ? "filled" : ""} ${className}`.trim()}
            aria-label={ariaLabel || name}
            role="img"
            onClick={onClick}
            style={style}
        >
            {name}
        </span>
    );
};

export default Icon;
