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
const server = spawn(process.execPath, [resolve(scriptsDir, "serve.mjs")], {
  cwd: clientDir,
  stdio: "inherit",
});

let timer;
watch(resolve(clientDir, "src"), { recursive: true }, () => {
  clearTimeout(timer);
  timer = setTimeout(
    () => runBuild().catch((error) => console.error(error)),
    150,
  );
});

function stop() {
  server.kill();
  process.exit(0);
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
