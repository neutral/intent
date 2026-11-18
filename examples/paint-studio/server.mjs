import http from "node:http";
import { readFile } from "node:fs/promises";
const assets = new Map([
  ["/", "index.html"],
  ["/app.js", "app.js"],
  ["/model.js", "model.js"],
  ["/render.js", "render.js"],
  ["/style.css", "style.css"],
]);
http
  .createServer(async (req, res) => {
    const file = assets.get(new URL(req.url, "http://localhost").pathname);
    if (!file) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    try {
      const body = await readFile(new URL(`./src/${file}`, import.meta.url));
      res.writeHead(200, {
        "Content-Type": file.endsWith(".js")
          ? "text/javascript"
          : file.endsWith(".css")
            ? "text/css"
            : "text/html",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(body);
    } catch {
      res.writeHead(500);
      res.end("Unable to load app");
    }
  })
  .listen(4380, "0.0.0.0", () =>
    console.log("Pigment listening on http://0.0.0.0:4380"),
  );
