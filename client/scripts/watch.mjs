import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const clientDir = resolve(scriptsDir, "..");

function runBuild() {
  return new Promise((resolveBuild, rejectBuild) => {
    const child = spawn(process.execPath, [resolve(scriptsDir, "build.mjs")], {
      cwd: clientDir,
      stdio: "inherit",
    });
    child.once("error", rejectBuild);
    child.once("exit", (code) =>
      code === 0
        ? resolveBuild()
        : rejectBuild(new Error(`Build exited with ${code}`)),
    );
  });
}

await runBuild();

// `wrangler dev` reads client/dist off disk, so rebuilding in place is all the
// watcher has to do -- there is no dev server of our own to reload.
let timer;
function scheduleBuild() {
  clearTimeout(timer);
  timer = setTimeout(
    () => runBuild().catch((error) => console.error(error)),
    150,
  );
}

watch(resolve(clientDir, "src"), { recursive: true }, scheduleBuild);
watch(resolve(clientDir, "index.html"), scheduleBuild);

console.log("Watching client/src and client/index.html");
