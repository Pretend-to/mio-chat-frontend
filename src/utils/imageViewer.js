import Viewer from "viewerjs";
import "viewerjs/dist/viewer.css";

let activeViewer = null;
let viewerContainer = null;

/**
 * Open full-featured image viewer supporting mobile touch gestures (pinch-to-zoom, pan, swipe)
 * and desktop navigation (keyboard arrow keys, mouse wheel zoom, thumbnail list).
 *
 * @param {Array<string|Object>} images - List of image URLs or objects { url, title, alt, original }
 * @param {number} [initialIndex=0] - Initial index to display
 * @param {Object} [customOptions={}] - Custom Viewer.js options
 * @returns {Viewer|null}
 */
export function previewImages(images, initialIndex = 0, customOptions = {}) {
  if (!images || !Array.isArray(images) || images.length === 0) {
    return null;
  }

  // Cleanup any previous viewer
  closeImageViewer();

  // Create hidden DOM container to hold image tags for Viewer.js
  viewerContainer = document.createElement("div");
  viewerContainer.className = "mio-image-viewer-container";
  viewerContainer.style.display = "none";

  images.forEach((item, index) => {
    const img = document.createElement("img");
    const src = typeof item === "string" ? item : item.url || item.src || "";
    const title =
      typeof item === "string"
        ? ""
        : item.title || item.name || item.fileName || item.alt || "";
    img.src = src;
    img.alt = title;
    img.setAttribute(
      "data-original",
      typeof item === "object" && item.original ? item.original : src,
    );
    img.setAttribute("data-index", String(index));
    viewerContainer.appendChild(img);
  });

  document.body.appendChild(viewerContainer);

  const isMulti = images.length > 1;
  const safeIndex = Math.max(0, Math.min(initialIndex, images.length - 1));

  const defaultOptions = {
    inline: false,
    button: true, // Close button at top right
    navbar: isMulti, // Bottom thumbnail navbar if multiple images
    title: (image) => {
      const alt = image.alt || "";
      const naturalWidth = image.naturalWidth;
      const naturalHeight = image.naturalHeight;
      if (naturalWidth && naturalHeight) {
        return alt
          ? `${alt} (${naturalWidth} × ${naturalHeight})`
          : `${naturalWidth} × ${naturalHeight}`;
      }
      return alt;
    },
    toolbar: {
      zoomIn: true,
      zoomOut: true,
      oneToOne: true,
      reset: true,
      prev: isMulti,
      play: false,
      next: isMulti,
      rotateLeft: true,
      rotateRight: true,
      flipHorizontal: true,
      flipVertical: true,
    },
    tooltip: true,
    movable: true,
    zoomable: true,
    rotatable: true,
    scalable: true,
    transition: true,
    fullscreen: true,
    keyboard: true,
    zIndex: 99999,
    initialViewIndex: safeIndex,
    hidden() {
      closeImageViewer();
      if (typeof customOptions.onClose === "function") {
        customOptions.onClose();
      }
    },
  };

  const mergedOptions = { ...defaultOptions, ...customOptions };
  activeViewer = new Viewer(viewerContainer, mergedOptions);
  activeViewer.show();

  if (safeIndex > 0) {
    activeViewer.view(safeIndex);
  }

  return activeViewer;
}

/**
 * Close and destroy active image viewer instance
 */
export function closeImageViewer() {
  if (activeViewer) {
    try {
      activeViewer.destroy();
    } catch (e) {
      console.warn("[ImageViewer] destroy error:", e);
    }
    activeViewer = null;
  }
  if (viewerContainer && viewerContainer.parentNode) {
    viewerContainer.parentNode.removeChild(viewerContainer);
    viewerContainer = null;
  }
}
