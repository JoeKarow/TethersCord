import { execFileSync } from "node:child_process";
import { cp, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const clientDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = resolve(clientDir, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });

execFileSync(
  "elm",
  ["make", "src/Main.elm", "--optimize", "--output", "dist/elm.js"],
  {
    cwd: clientDir,
    stdio: "inherit",
  },
);

await build({
  absWorkingDir: clientDir,
  entryPoints: ["src/main.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  outfile: "dist/main.js",
  sourcemap: true,
});

await cp(resolve(clientDir, "index.html"), resolve(distDir, "index.html"));

console.log("Client built in client/dist");
