import path from "node:path";
import chokidar from "chokidar";
import { buildProject } from "./build.js";
import { loadConfig } from "./config.js";

export async function runDev(projectDir: string): Promise<void> {
  await runBuildAttempt(projectDir);

  let timer: NodeJS.Timeout | undefined;
  const watcher = chokidar.watch(
    [
      path.join(projectDir, "src/**/*.ts"),
      path.join(projectDir, "scaffolding.config.ts"),
      path.join(projectDir, "assets/**/*"),
    ],
    {
      ignoreInitial: true,
      ignored: [path.join(projectDir, "dist/**"), path.join(projectDir, "node_modules/**")],
    },
  );

  watcher.on("all", () => {
    if (timer) {
      clearTimeout(timer);
    }
    timer = setTimeout(() => {
      void runBuildAttempt(projectDir);
    }, 100);
  });

  process.on("SIGINT", () => {
    void watcher.close().then(() => process.exit(0));
  });
}

async function runBuildAttempt(projectDir: string): Promise<void> {
  try {
    const config = await loadConfig(projectDir);
    const result = await buildProject(projectDir, config, { sync: true });
    console.log(`Built ${path.relative(projectDir, result.distDir)}`);
    if (result.syncedTo) {
      console.log(`Synced ${result.syncedTo}`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  }
}
