/**
 * OpenSource Arch — Dev Server
 *
 * Build + serve docs/ with live reload.
 * Run with: bun --watch site/dev.ts
 *
 * bun --watch auto-restarts this process when any imported file changes.
 * We import source files (CSS, JS) so bun tracks them too.
 */

import { join, extname } from "node:path";
import { existsSync } from "node:fs";

const ROOT = import.meta.dir.replace(/\/site$/, "");
const DOCS_DIR = join(ROOT, "docs");
const SITE_SRC = join(ROOT, "site/src");
const PORT = parseInt(process.env.PORT || "3000", 10);

// Import source files so bun --watch tracks them
import "./src/styles.css";
import "./src/diagram-viewer.js";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

const LIVE_RELOAD_SCRIPT = `
<script>
  (() => {
    const es = new EventSource('/__livereload');
    es.onmessage = () => location.reload();
    es.onerror = () => setTimeout(() => location.reload(), 1000);
  })();
</script>`;

// ─── Build ───────────────────────────────────────────

console.log("  Building...\n");
const proc = Bun.spawn(["bun", "run", "site/build.ts"], {
  cwd: ROOT,
  stdout: "inherit",
  stderr: "inherit",
});
await proc.exited;
if (proc.exitCode !== 0) {
  console.error("  ✗ Build failed\n");
}

// ─── Serve ───────────────────────────────────────────

let buildGeneration = 0;

function injectLiveReload(html: string): string {
  return html.replace("</body>", `${LIVE_RELOAD_SCRIPT}\n</body>`);
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // Live reload SSE endpoint
    if (url.pathname === "/__livereload") {
      const gen = buildGeneration;
      return new Response(
        new ReadableStream({
          start(controller) {
            const interval = setInterval(() => {
              if (buildGeneration !== gen) {
                controller.enqueue("data: reload\n\n");
                clearInterval(interval);
                controller.close();
              }
            }, 200);
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        }
      );
    }

    // Resolve path to file
    let filePath = join(DOCS_DIR, url.pathname);
    if (filePath.endsWith("/")) filePath += "index.html";
    if (!existsSync(filePath)) filePath += ".html";

    if (!existsSync(filePath)) {
      return new Response("Not Found", { status: 404 });
    }

    const file = Bun.file(filePath);
    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";

    let body: string | ArrayBuffer = await file.arrayBuffer();
    if (ext === ".html") {
      body = injectLiveReload(new TextDecoder().decode(body));
    }

    return new Response(body, {
      headers: { "Content-Type": contentType },
    });
  },
});

console.log(`\n  Serving at http://localhost:${server.port}\n`);
