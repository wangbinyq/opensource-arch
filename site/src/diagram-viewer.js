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

function closeOverlay(overlay) {
  overlay.style.opacity = "0";
  setTimeout(() => overlay.remove(), 150);
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

  const diagramEl = overlay.querySelector(".mermaid-fullscreen__diagram");
  const svgEl = diagramEl.querySelector("svg");
  const zoomLabel = overlay.querySelector(".mermaid-toolbar__zoom");

  svgEl.style.transformOrigin = "center center";
  svgEl.style.overflow = "visible";

  const pz = Panzoom(svgEl, {
    maxScale: 5,
    minScale: 0.1,
    contain: "outside",
    cursor: "grab",
    excludeClass: "mermaid-fullscreen__toolbar",
  });

  function updateZoomLabel() {
    zoomLabel.textContent = Math.round(pz.getScale() * 100) + "%";
  }

  diagramEl.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      pz.zoomToPoint(pz.getScale() + delta, e);
      updateZoomLabel();
    },
    { passive: false }
  );

  svgEl.addEventListener("panzoomend", () => {
    svgEl.style.cursor = "grab";
  });
  svgEl.addEventListener("panzoomstart", () => {
    svgEl.style.cursor = "grabbing";
  });

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
  overlay
    .querySelector('[data-action="fit"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      fitDiagram();
    });
  overlay
    .querySelector('[data-action="reset"]')
    .addEventListener("click", (e) => {
      e.stopPropagation();
      pz.reset();
      updateZoomLabel();
    });

  function fitDiagram() {
    const dRect = diagramEl.getBoundingClientRect();
    const sRect = svgEl.getBoundingClientRect();
    const scaleX = (dRect.width - 40) / sRect.width;
    const scaleY = (dRect.height - 40) / sRect.height;
    const scale = Math.min(scaleX, scaleY, 1) / pz.getScale();
    pz.zoomToPoint(pz.getScale() * scale, {
      clientX: dRect.left + dRect.width / 2,
      clientY: dRect.top + dRect.height / 2,
    });
    pz.pan(0, 0);
    updateZoomLabel();
  }

  const closeBtn = overlay.querySelector(".mermaid-fullscreen__close");
  closeBtn.addEventListener("click", () => closeOverlay(overlay));

  const onKey = (ev) => {
    if (ev.key === "Escape") {
      closeOverlay(overlay);
      document.removeEventListener("keydown", onKey);
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

  document.body.appendChild(overlay);
  closeBtn.focus();
}

document.addEventListener("click", (e) => {
  const pre = e.target.closest("pre.mermaid");
  if (pre) openFullscreen(pre);
});
