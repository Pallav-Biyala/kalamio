// vite.config.js
import { defineConfig } from "file:///D:/Projects/blogApp/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///D:/Projects/blogApp/frontend/node_modules/@vitejs/plugin-react/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            const path = id.replace(/\\/g, "/");
            if (path.includes("/node_modules/react/") || path.includes("/node_modules/react-dom/") || path.includes("/node_modules/react-router")) {
              return "vendor-react";
            }
            if (id.includes("@tiptap/")) {
              return "vendor-editor";
            }
            if (id.includes("lowlight") || id.includes("highlight.js")) {
              return "vendor-highlight";
            }
            if (id.includes("axios")) {
              return "vendor-axios";
            }
          }
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxibG9nQXBwXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJEOlxcXFxQcm9qZWN0c1xcXFxibG9nQXBwXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9EOi9Qcm9qZWN0cy9ibG9nQXBwL2Zyb250ZW5kL3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcblxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIHBsdWdpbnM6IFtyZWFjdCgpXSxcbiAgYnVpbGQ6IHtcbiAgICByb2xsdXBPcHRpb25zOiB7XG4gICAgICBvdXRwdXQ6IHtcbiAgICAgICAgbWFudWFsQ2h1bmtzKGlkKSB7XG4gICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSkge1xuICAgICAgICAgICAgY29uc3QgcGF0aCA9IGlkLnJlcGxhY2UoL1xcXFwvZywgJy8nKTtcbiAgICAgICAgICAgIGlmIChwYXRoLmluY2x1ZGVzKCcvbm9kZV9tb2R1bGVzL3JlYWN0LycpIHx8IHBhdGguaW5jbHVkZXMoJy9ub2RlX21vZHVsZXMvcmVhY3QtZG9tLycpIHx8IHBhdGguaW5jbHVkZXMoJy9ub2RlX21vZHVsZXMvcmVhY3Qtcm91dGVyJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItcmVhY3QnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKCdAdGlwdGFwLycpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLWVkaXRvcic7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2xvd2xpZ2h0JykgfHwgaWQuaW5jbHVkZXMoJ2hpZ2hsaWdodC5qcycpKSB7XG4gICAgICAgICAgICAgIHJldHVybiAndmVuZG9yLWhpZ2hsaWdodCc7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoJ2F4aW9zJykpIHtcbiAgICAgICAgICAgICAgcmV0dXJuICd2ZW5kb3ItYXhpb3MnO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQThRLFNBQVMsb0JBQW9CO0FBQzNTLE9BQU8sV0FBVztBQUdsQixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxDQUFDO0FBQUEsRUFDakIsT0FBTztBQUFBLElBQ0wsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLGtCQUFNLE9BQU8sR0FBRyxRQUFRLE9BQU8sR0FBRztBQUNsQyxnQkFBSSxLQUFLLFNBQVMsc0JBQXNCLEtBQUssS0FBSyxTQUFTLDBCQUEwQixLQUFLLEtBQUssU0FBUyw0QkFBNEIsR0FBRztBQUNySSxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsVUFBVSxHQUFHO0FBQzNCLHFCQUFPO0FBQUEsWUFDVDtBQUNBLGdCQUFJLEdBQUcsU0FBUyxVQUFVLEtBQUssR0FBRyxTQUFTLGNBQWMsR0FBRztBQUMxRCxxQkFBTztBQUFBLFlBQ1Q7QUFDQSxnQkFBSSxHQUFHLFNBQVMsT0FBTyxHQUFHO0FBQ3hCLHFCQUFPO0FBQUEsWUFDVDtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
