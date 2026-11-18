// Minimal static file server for the tests, so they run against the real app files without extra tools.
// Serves the repository root on a random free port and returns the base URL.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png"
};

export async function startStaticServer() {
  const server = http.createServer(async (req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const filePath = path.join(ROOT, urlPath.endsWith("/") ? `${urlPath}index.html` : urlPath);

    // Refuse paths that escape the repository root.
    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }

    try {
      const body = await readFile(filePath);
      res.writeHead(200, {
        "content-type": TYPES[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { url: `http://localhost:${port}`, close: () => new Promise((r) => server.close(r)) };
}
