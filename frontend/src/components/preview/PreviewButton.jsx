import { useContext } from "react";
import { EditorContext } from "../../pages/editor.pages";
import Icon from "../Icon";

/**
 * The "Preview" entry point shown in every publish-phase nav (editor / details / scroll cover).
 * Calls `openPreview` from the editor context, which flushes the latest editor body and opens the
 * full-screen preview overlay. Label collapses to just the icon on small screens.
 */
const PreviewButton = () => {
    const { openPreview } = useContext(EditorContext);

    return (
        <button
            type="button"
            onClick={openPreview}
            className="flex items-center gap-1.5 py-2 px-3 md:px-4 rounded-full border border-border text-black font-medium hover:bg-grey transition-colors"
            aria-label="Preview how this will look after publishing"
        >
            <Icon name="visibility" className="text-lg" />
            <span className="hidden md:inline text-sm">Preview</span>
        </button>
    );
};

export default PreviewButton;
