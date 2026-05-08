/**
 * OpenSource Arch — Static Site Generator
 *
 * Reads analyses/*.md, generates a minimal GitHub Pages site.
 * Output goes to docs/ for GitHub Pages deployment.
 *
 * Usage:  bun run site/build.ts
 */

import { readdir, readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { join, relative, basename, dirname } from "node:path";
import { existsSync } from "node:fs";

// ─── Config ───────────────────────────────────────────

const ROOT = import.meta.dir.replace(/\/site$/, "");
const ANALYSES_DIR = join(ROOT, "analyses");
const SITE_SRC = join(ROOT, "site/src");
const OUT_DIR = join(ROOT, "docs");
const BASE_PATH = (process.env.BASE_PATH || "").replace(/\/+$/, "");

const SITE_TITLE = "OpenSource Arch";
const SITE_TAGLINE = "著名开源项目架构分析";

// ─── Markdown → HTML (minimal, zero-dependency) ──────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseMarkdown(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inCodeBlock = false;
  let codeContent = "";
  let codeLang = "";
  let inTable = false;
  let tableRows: string[][] = [];
  let tableAlign: string[] = [];
  let inList = false;
  let listType = "";
  let inParagraph = false;

  function closeList() {
    if (!inList) return;
    html += listType === "ul" ? "</ul>\n" : "</ol>\n";
    inList = false;
    listType = "";
  }

  function closeParagraph() {
    if (inParagraph) {
      html += "</p>\n";
      inParagraph = false;
    }
  }

  function closeTable() {
    if (!inTable) return;
    if (tableRows.length > 0) {
      html += "<table>\n<thead>\n<tr>\n";
      const header = tableRows[0];
      for (let i = 0; i < header.length; i++) {
        const align = tableAlign[i]
          ? ` style="text-align:${tableAlign[i]}"`
          : "";
        html += `<th${align}>${inlineFormat(header[i])}</th>\n`;
      }
      html += "</tr>\n</thead>\n";
      if (tableRows.length > 2) {
        html += "<tbody>\n";
        for (let r = 2; r < tableRows.length; r++) {
          html += "<tr>\n";
          for (let i = 0; i < tableRows[r].length; i++) {
            const align = tableAlign[i]
              ? ` style="text-align:${tableAlign[i]}"`
              : "";
            html += `<td${align}>${inlineFormat(tableRows[r][i])}</td>\n`;
          }
          html += "</tr>\n";
        }
        html += "</tbody>\n";
      }
      html += "</table>\n";
    }
    inTable = false;
    tableRows = [];
    tableAlign = [];
  }

  function inlineFormat(text: string): string {
    // Code spans
    text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // Links
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>'
    );
    // Handle <br> inside tables
    text = text.replace(/<br\s*\/?>/gi, "<br>");
    return text;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.trimStart().startsWith("```")) {
      if (inCodeBlock) {
        closeParagraph();
        if (codeLang === "mermaid") {
          html += `<pre class="mermaid">${escapeHtml(codeContent.trimEnd())}</pre>\n`;
        } else {
          html += `<pre><code${
            codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ""
          }>${escapeHtml(codeContent.trimEnd())}</code></pre>\n`;
        }
        inCodeBlock = false;
        codeContent = "";
        codeLang = "";
        continue;
      } else {
        closeParagraph();
        closeList();
        closeTable();
        inCodeBlock = true;
        codeLang = line.trimStart().slice(3).trim();
        codeContent = "";
        continue;
      }
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    // Tables
    if (line.includes("|") && line.trim().startsWith("|")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());
      if (
        cells.every((c) => /^[\s:-]+$/.test(c))
      ) {
        // Separator row
        tableAlign = cells.map((c) => {
          if (c.startsWith(":") && c.endsWith(":")) return "center";
          if (c.endsWith(":")) return "right";
          if (c.startsWith(":")) return "left";
          return "";
        });
        continue;
      }
      closeParagraph();
      closeList();
      inTable = true;
      tableRows.push(cells);
      continue;
    } else if (inTable) {
      closeTable();
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      closeParagraph();
      closeList();
      closeTable();
      html += "<hr>\n";
      continue;
    }

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headingMatch) {
      closeParagraph();
      closeList();
      closeTable();
      const level = headingMatch[1].length;
      const text = inlineFormat(headingMatch[2]);
      html += `<h${level}>${text}</h${level}>\n`;
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      closeParagraph();
      closeList();
      closeTable();
      const text = inlineFormat(line.replace(/^>\s?/, ""));
      html += `<blockquote><p>${text}</p></blockquote>\n`;
      continue;
    }

    // Unordered list
    const ulMatch = line.match(/^(\s*)[-*+]\s+(.+)/);
    if (ulMatch) {
      closeParagraph();
      closeTable();
      if (!inList || listType !== "ul") {
        closeList();
        html += "<ul>\n";
        inList = true;
        listType = "ul";
      }
      html += `<li>${inlineFormat(ulMatch[2])}</li>\n`;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+\.\s+(.+)/);
    if (olMatch) {
      closeParagraph();
      closeTable();
      if (!inList || listType !== "ol") {
        closeList();
        html += "<ol>\n";
        inList = true;
        listType = "ol";
      }
      html += `<li>${inlineFormat(olMatch[2])}</li>\n`;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      closeParagraph();
      closeList();
      closeTable();
      continue;
    }

    // Paragraph
    closeList();
    closeTable();
    if (!inParagraph) {
      html += "<p>";
      inParagraph = true;
    } else {
      html += " ";
    }
    html += inlineFormat(line.trim());
  }

  closeParagraph();
  closeList();
  closeTable();

  return html;
}

// ─── Extract metadata from MD ────────────────────────

interface AnalysisMeta {
  slug: string;
  title: string;
  version: string;
  date: string;
  language: string;
  description: string;
  html: string;
}

function extractTitle(md: string): string {
  const m = md.match(/^#\s+(.+)/m);
  return m ? m[1].trim() : "Untitled";
}

function extractSubtitle(md: string): { version: string; date: string } {
  const m = md.match(/>.*?v?([\d.v]+).*?(\d{4}-\d{2}-\d{2})/);
  return {
    version: m ? m[1] : "",
    date: m ? m[2] : "",
  };
}

function extractLanguage(md: string): string {
  const m = md.match(/\|\s*编程语言\s*\|\s*(.+?)\s*\|/);
  return m ? m[1].trim() : "";
}

function extractDescription(md: string): string {
  // Get the **项目简介** paragraph
  const m = md.match(/\*\*项目简介\*\*\s*\n\n(.+?)(?:\n\n|\n##)/s);
  if (m) {
    const desc = m[1]
      .replace(/\n/g, " ")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .trim();
    return desc.length > 120 ? desc.slice(0, 117) + "..." : desc;
  }
  return "";
}

// ─── HTML templates ──────────────────────────────────

function renderHead(title: string, description: string = ""): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>${
    description
      ? `\n  <meta name="description" content="${escapeHtml(description)}">`
      : ""
  }
  <link rel="stylesheet" href="${BASE_PATH}/css/styles.css">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📐</text></svg>">
  <script type="module">
    import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
    import Panzoom from 'https://cdn.jsdelivr.net/npm/@panzoom/panzoom@4/dist/panzoom.esm.mjs';

    mermaid.initialize({
      startOnLoad: true,
      theme: 'base',
      themeVariables: {
        primaryColor: '#e8d5cf',
        primaryTextColor: '#2c2a27',
        primaryBorderColor: '#bfb9b1',
        lineColor: '#9f9890',
        secondaryColor: '#fdfbf8',
        tertiaryColor: '#f7f4ef',
        fontFamily: 'system-ui, "Noto Sans SC", sans-serif',
        fontSize: '14px',
        nodeBorder: '#bfb9b1',
        clusterBkg: '#fdfbf8',
        clusterBorder: '#d8d3cc',
        edgeLabelBackground: '#f7f4ef',
      }
    });

    function closeOverlay(overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => overlay.remove(), 150);
    }

    function openFullscreen(pre) {
      const svg = pre.querySelector('svg');
      if (!svg) return;

      const overlay = document.createElement('div');
      overlay.className = 'mermaid-fullscreen';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Diagram fullscreen view');
      overlay.innerHTML =
        '<div class="mermaid-fullscreen__toolbar">' +
          '<div class="mermaid-toolbar__group">' +
            '<button class="mermaid-toolbar__btn" data-action="zoom-out" aria-label="Zoom out" title="Zoom out">\u2212</button>' +
            '<span class="mermaid-toolbar__zoom">100%</span>' +
            '<button class="mermaid-toolbar__btn" data-action="zoom-in" aria-label="Zoom in" title="Zoom in">+</button>' +
          '</div>' +
          '<div class="mermaid-toolbar__group">' +
            '<button class="mermaid-toolbar__btn" data-action="fit" aria-label="Fit to screen" title="Fit to screen">\u2922</button>' +
            '<button class="mermaid-toolbar__btn" data-action="reset" aria-label="Reset view" title="Reset (100%)">1:1</button>' +
          '</div>' +
          '<button class="mermaid-fullscreen__close" aria-label="Close" title="Close (Esc)">\u2715</button>' +
        '</div>' +
        '<div class="mermaid-fullscreen__diagram">' + svg.outerHTML + '</div>';

      const diagramEl = overlay.querySelector('.mermaid-fullscreen__diagram');
      const svgEl = diagramEl.querySelector('svg');
      const zoomLabel = overlay.querySelector('.mermaid-toolbar__zoom');

      // Ensure SVG can be transformed
      svgEl.style.transformOrigin = 'center center';
      svgEl.style.overflow = 'visible';

      const pz = Panzoom(svgEl, {
        maxScale: 5,
        minScale: 0.1,
        contain: 'outside',
        cursor: 'grab',
        excludeClass: 'mermaid-fullscreen__toolbar',
      });

      function updateZoomLabel() {
        zoomLabel.textContent = Math.round(pz.getScale() * 100) + '%';
      }

      // Wheel zoom
      diagramEl.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        pz.zoomToPoint(pz.getScale() + delta, e);
        updateZoomLabel();
      }, { passive: false });

      // Pan end: update cursor
      svgEl.addEventListener('panzoomend', () => { svgEl.style.cursor = 'grab'; });
      svgEl.addEventListener('panzoomstart', () => { svgEl.style.cursor = 'grabbing'; });

      // Toolbar buttons
      overlay.querySelector('[data-action="zoom-in"]').addEventListener('click', (e) => {
        e.stopPropagation(); pz.zoomIn(); updateZoomLabel();
      });
      overlay.querySelector('[data-action="zoom-out"]').addEventListener('click', (e) => {
        e.stopPropagation(); pz.zoomOut(); updateZoomLabel();
      });
      overlay.querySelector('[data-action="fit"]').addEventListener('click', (e) => {
        e.stopPropagation(); fitDiagram();
      });
      overlay.querySelector('[data-action="reset"]').addEventListener('click', (e) => {
        e.stopPropagation(); pz.reset(); updateZoomLabel();
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

      // Close
      const closeBtn = overlay.querySelector('.mermaid-fullscreen__close');
      closeBtn.addEventListener('click', () => closeOverlay(overlay));

      // Keyboard shortcuts
      const onKey = (ev) => {
        if (ev.key === 'Escape') {
          closeOverlay(overlay);
          document.removeEventListener('keydown', onKey);
        } else if (ev.key === '+' || ev.key === '=') {
          pz.zoomIn(); updateZoomLabel();
        } else if (ev.key === '-') {
          pz.zoomOut(); updateZoomLabel();
        } else if (ev.key === '0') {
          pz.reset(); updateZoomLabel();
        } else if (ev.key === 'f') {
          fitDiagram();
        }
      };
      document.addEventListener('keydown', onKey);

      document.body.appendChild(overlay);
      closeBtn.focus();
    }

    document.addEventListener('click', (e) => {
      const pre = e.target.closest('pre.mermaid');
      if (pre) openFullscreen(pre);
    });
  </script>
</head>`;
}

function renderIndexPage(analyses: AnalysisMeta[]): string {
  const items = analyses
    .map(
      (a) => `    <li class="index__item">
      <a class="index__link" href="${BASE_PATH}/${a.slug}/">
        <span class="index__name">${escapeHtml(a.title)}</span>
        <span class="index__meta">${a.language}</span>
      </a>
      ${a.description ? `<p class="index__desc">${escapeHtml(a.description)}</p>` : ""}
    </li>`
    )
    .join("\n");

  return `${renderHead(SITE_TITLE, SITE_TAGLINE)}
<body>
  <div class="page">
    <header class="site-header">
      <h1 class="site-header__title">${SITE_TITLE}</h1>
      <p class="site-header__tagline">${SITE_TAGLINE}</p>
    </header>

    <hr class="rule">

    <ul class="index">
${items}
    </ul>

    <footer class="site-footer">
      <p><a href="https://github.com/wangbinyq/opensource-arch">GitHub</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function renderArticlePage(a: AnalysisMeta): string {
  const subtitle = [a.version, a.date].filter(Boolean).join(" · ");
  return `${renderHead(a.title)}
<body>
  <div class="page">
    <a class="back-link" href="${BASE_PATH}/">
      <span class="back-link__arrow">←</span> 返回目录
    </a>

    <article>
      <header class="article-header">
        <h1 class="article-header__title">${escapeHtml(a.title)}</h1>
        ${
          subtitle
            ? `<p class="article-header__subtitle">${escapeHtml(subtitle)}</p>`
            : ""
        }
      </header>

      <div class="article-body">
        ${a.html}
      </div>
    </article>

    <footer class="site-footer">
      <p><a href="${BASE_PATH}/">返回目录</a> · <a href="https://github.com/wangbinyq/opensource-arch">GitHub</a></p>
    </footer>
  </div>
</body>
</html>`;
}

// ─── Build pipeline ──────────────────────────────────

async function scanAnalyses(): Promise<string[]> {
  const entries = await readdir(ANALYSES_DIR, { withFileTypes: true });
  return entries
    .filter((e) => e.isDirectory() && existsSync(join(ANALYSES_DIR, e.name, "README.md")))
    .map((e) => e.name);
}

async function processAnalysis(slug: string): Promise<AnalysisMeta> {
  const mdPath = join(ANALYSES_DIR, slug, "README.md");
  const md = await readFile(mdPath, "utf-8");
  const { version, date } = extractSubtitle(md);

  return {
    slug,
    title: extractTitle(md),
    version,
    date,
    language: extractLanguage(md),
    description: extractDescription(md),
    html: parseMarkdown(md),
  };
}

async function build() {
  console.log("Site builder starting...");
  console.log(`  Root:         ${ROOT}`);
  console.log(`  Analyses:     ${ANALYSES_DIR}`);
  console.log(`  Output:       ${OUT_DIR}`);

  // Clean & create output dir
  if (existsSync(OUT_DIR)) {
    const { rm } = await import("node:fs/promises");
    await rm(OUT_DIR, { recursive: true });
  }
  await mkdir(OUT_DIR, { recursive: true });
  await mkdir(join(OUT_DIR, "css"), { recursive: true });

  // Scan analyses
  const slugs = await scanAnalyses();
  console.log(`  Found ${slugs.length} analyses: ${slugs.join(", ")}`);

  // Process each analysis
  const analyses: AnalysisMeta[] = [];
  for (const slug of slugs) {
    const meta = await processAnalysis(slug);
    analyses.push(meta);
    console.log(`  Processed: ${meta.title}`);
  }

  // Sort by title
  analyses.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));

  // Generate index page
  const indexHtml = renderIndexPage(analyses);
  await writeFile(join(OUT_DIR, "index.html"), indexHtml);
  console.log("  Generated: index.html");

  // Generate article pages
  for (const a of analyses) {
    const articleDir = join(OUT_DIR, a.slug);
    await mkdir(articleDir, { recursive: true });
    const articleHtml = renderArticlePage(a);
    await writeFile(join(articleDir, "index.html"), articleHtml);
    console.log(`  Generated: ${a.slug}/index.html`);
  }

  // Copy CSS
  await copyFile(join(SITE_SRC, "styles.css"), join(OUT_DIR, "css", "styles.css"));
  console.log("  Copied: css/styles.css");

  // Copy mermaid diagrams (if any)
  for (const slug of slugs) {
    const analysisDir = join(ANALYSES_DIR, slug);
    const files = await readdir(analysisDir);
    const mmdFiles = files.filter(
      (f) => f.endsWith(".mmd") || f.endsWith(".mermaid")
    );
    if (mmdFiles.length > 0) {
      const destDir = join(OUT_DIR, slug, "diagrams");
      await mkdir(destDir, { recursive: true });
      for (const f of mmdFiles) {
        await copyFile(join(analysisDir, f), join(destDir, f));
      }
      console.log(`  Copied ${mmdFiles.length} diagrams for ${slug}`);
    }
  }

  console.log("\nDone.");
}

build().catch((err) => {
  console.error("Build failed:", err);
  process.exit(1);
});
