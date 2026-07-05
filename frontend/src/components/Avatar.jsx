import Icon from "./Icon";

/**
 * Avatar component — renders initials-based avatar or real image.
 * 
 * If profile_img starts with "avatar:", it parses the format:
 *   "avatar:#HEX:INITIALS" → colored circle with white initials
 * 
 * Otherwise, renders a normal <img> tag.
 */
const Avatar = ({ src, alt = "avatar", className = "", size = 40 }) => {

    if (!src) {
        return (
            <div
                className={`flex items-center justify-center bg-grey text-dark-grey ${className}`}
                style={{
                    width: size,
                    height: size,
                    minWidth: size,
                    minHeight: size,
                    borderRadius: "50%",
                    flexShrink: 0,
                }}
            >
                <Icon name="person" style={{ fontSize: size * 0.6 }} />
            </div>
        );
    }

    // Check if it's an initials avatar
    if (src && src.startsWith("avatar:")) {
        const parts = src.split(":");
        const color = parts[1];   // e.g. "#6D5D4B"
        const initials = parts[2] || "?"; // e.g. "HS"

        return (
            <div
                className={`avatar-initials ${className}`}
                style={{
                    width: size,
                    height: size,
                    minWidth: size,
                    minHeight: size,
                    backgroundColor: color,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontFamily: "'DM Sans', sans-serif",
                    fontWeight: 600,
                    fontSize: size * 0.38,
                    letterSpacing: "0.5px",
                    lineHeight: 1,
                    userSelect: "none",
                    flexShrink: 0,
                }}
            >
                {initials}
            </div>
        );
    }

    // Real image URL
    return (
        <img
            src={src}
            alt={alt}
            className={className}
            referrerPolicy="no-referrer"
            style={{
                width: size,
                height: size,
                minWidth: size,
                minHeight: size,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
            }}
        />
    );
};

export default Avatar;
