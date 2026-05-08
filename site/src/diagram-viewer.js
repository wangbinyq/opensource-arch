import mermaid from "mermaid";
import Panzoom from "@panzoom/panzoom";

mermaid.initialize({
  startOnLoad: true,
  theme: "base",
  themeVariables: {
    primaryColor: "#e8d5cf",
    primaryTextColor: "#2c2a27",
    primaryBorderColor: "#bfb9b1",
    lineColor: "#9f9890",
    secondaryColor: "#fdfbf8",
    tertiaryColor: "#f7f4ef",
    fontFamily: 'system-ui, "Noto Sans SC", sans-serif',
    fontSize: "14px",
    nodeBorder: "#bfb9b1",
    clusterBkg: "#fdfbf8",
    clusterBorder: "#d8d3cc",
    edgeLabelBackground: "#f7f4ef",
  },
});

function closeOverlay(overlay, onKey) {
  document.removeEventListener("keydown", onKey);
  overlay.style.opacity = "0";
  setTimeout(() => overlay.remove(), 150);
}

function getNaturalSize(svg) {
  // Use viewBox first, then width/height attributes
  const vb = svg.getAttribute("viewBox");
  if (vb) {
    const parts = vb.split(/[\s,]+/).map(Number);
    if (parts.length === 4) return { w: parts[2], h: parts[3] };
  }
  return {
    w: parseFloat(svg.getAttribute("width")) || svg.getBBox().width,
    h: parseFloat(svg.getAttribute("height")) || svg.getBBox().height,
  };
}

function openFullscreen(pre) {
  const svg = pre.querySelector("svg");
  if (!svg) return;

  const overlay = document.createElement("div");
  overlay.className = "mermaid-fullscreen";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Diagram fullscreen view");
  overlay.innerHTML =
    '<div class="mermaid-fullscreen__toolbar">' +
    '<div class="mermaid-toolbar__group">' +
    '<button class="mermaid-toolbar__btn" data-action="zoom-out" aria-label="Zoom out" title="Zoom out">\u2212</button>' +
    '<span class="mermaid-toolbar__zoom">100%</span>' +
    '<button class="mermaid-toolbar__btn" data-action="zoom-in" aria-label="Zoom in" title="Zoom in">+</button>' +
    "</div>" +
    '<div class="mermaid-toolbar__group">' +
    '<button class="mermaid-toolbar__btn" data-action="fit" aria-label="Fit to screen" title="Fit to screen">\u2922</button>' +
    '<button class="mermaid-toolbar__btn" data-action="reset" aria-label="Reset view" title="Reset (100%)">1:1</button>' +
    "</div>" +
    '<button class="mermaid-fullscreen__close" aria-label="Close" title="Close (Esc)">\u2715</button>' +
    "</div>" +
    '<div class="mermaid-fullscreen__diagram">' +
    svg.outerHTML +
    "</div>";

  // Mount to DOM first — Panzoom requires it
  document.body.appendChild(overlay);

  const diagramEl = overlay.querySelector(".mermaid-fullscreen__diagram");
  const svgEl = diagramEl.querySelector("svg");
  const zoomLabel = overlay.querySelector(".mermaid-toolbar__zoom");

  // Let SVG fill the container naturally
  svgEl.removeAttribute("width");
  svgEl.removeAttribute("height");
  svgEl.removeAttribute("style");

  // Get natural dimensions before Panzoom takes over
  const natural = getNaturalSize(svgEl);

  const pz = Panzoom(svgEl, {
    maxScale: 8,
    minScale: 0.05,
    cursor: "grab",
    excludeClass: "mermaid-fullscreen__toolbar",
    startScale: 1,
  });

  function updateZoomLabel() {
    zoomLabel.textContent = Math.round(pz.getScale() * 100) + "%";
  }

  // Wheel zoom
  diagramEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newScale = Math.max(0.05, Math.min(8, pz.getScale() + delta));
      pz.zoomToPoint(newScale, e);
      updateZoomLabel();
    },
    { passive: false }
  );

  // Cursor feedback
  svgEl.addEventListener("panzoomend", () => {
    svgEl.style.cursor = "grab";
  });
  svgEl.addEventListener("panzoomstart", () => {
    svgEl.style.cursor = "grabbing";
  });

  // Toolbar: zoom in/out
  overlay
    .querySelector('[data-action="zoom-in"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      pz.zoomIn();
      updateZoomLabel();
    });
  overlay
    .querySelector('[data-action="zoom-out"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      pz.zoomOut();
      updateZoomLabel();
    });

  // Toolbar: fit to screen
  overlay
    .querySelector('[data-action="fit"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      fitDiagram();
    });

  // Toolbar: reset to 100%
  overlay
    .querySelector('[data-action="reset"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      pz.reset();
      updateZoomLabel();
    });

  function fitDiagram() {
    const pad = 32;
    const dW = diagramEl.clientWidth - pad * 2;
    const dH = diagramEl.clientHeight - pad * 2;
    const scale = Math.min(dW / natural.w, dH / natural.h, 1);

    // Reset pan first, then set scale and center
    pz.reset({ animate: false });
    pz.zoom(scale, { animate: false });

    // Center in container
    const scaledW = natural.w * scale;
    const scaledH = natural.h * scale;
    const panX = (dW - scaledW) / 2 + pad;
    const panY = (dH - scaledH) / 2 + pad;
    pz.pan(panX, panY, { animate: false });

    updateZoomLabel();
  }

  // Close button
  const closeBtn = overlay.querySelector(".mermaid-fullscreen__close");
  closeBtn.addEventListener("click", () => closeOverlay(overlay, onKey));

  // Keyboard shortcuts
  const onKey = (ev) => {
    if (ev.key === "Escape") {
      closeOverlay(overlay, onKey);
    } else if (ev.key === "+" || ev.key === "=") {
      pz.zoomIn();
      updateZoomLabel();
    } else if (ev.key === "-") {
      pz.zoomOut();
      updateZoomLabel();
    } else if (ev.key === "0") {
      pz.reset();
      updateZoomLabel();
    } else if (ev.key === "f") {
      fitDiagram();
    }
  };
  document.addEventListener("keydown", onKey);

  closeBtn.focus();

  // Auto-fit diagram to viewport on open
  requestAnimationFrame(() => fitDiagram());
}

document.addEventListener("click", (e) => {
  const pre = e.target.closest("pre.mermaid");
  if (pre) openFullscreen(pre);
});
