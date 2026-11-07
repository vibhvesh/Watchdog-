import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export function normalizeBase(input: string | undefined): string {
  if (!input || input === "/") return "/";
  const withSlash = input.startsWith("/") ? input : `/${input}`;
  return withSlash.endsWith("/") ? withSlash : `${withSlash}/`;
}

const base = normalizeBase(process.env.PAGES_BASE);

export default defineConfig({
  base,
  plugins: [
    react(),
    {
      name: "github-pages-files",
      closeBundle() {
        const dist = resolve("dist");
        writeFileSync(resolve(dist, ".nojekyll"), "");
        const prefix = base === "/" ? "" : base.slice(0, -1);
        writeFileSync(
          resolve(dist, "404.html"),
          `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Boondockecho</title>
  <script>
    var prefix = ${JSON.stringify(prefix)};
    var path = location.pathname;
    if (prefix && path.indexOf(prefix) === 0) path = path.slice(prefix.length);
    path = path.replace(/^\\//, "").replace(/\\/index\\.html$/, "");
    location.replace(prefix + "/#/" + path + location.search);
  </script>
</head>
<body>Opening the Boondockecho sample…</body>
</html>`,
        );
      },
    },
  ],
  build: { outDir: "dist", emptyOutDir: true },
});
