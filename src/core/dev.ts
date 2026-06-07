import path from "node:path";
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";
import { buildProject } from "./build.js";
import { behaviorSourceDir, configFileName, internalOutDir, loadConfig } from "./config.js";

export async function runDev(projectDir: string): Promise<void> {
  const config = await loadConfig(projectDir);
  await runBuildAttempt(projectDir);
  const srcDir = path.join(projectDir, "src");
  const behaviorDir = path.join(projectDir, config.build?.behaviorDir ?? behaviorSourceDir);
  const configPath = path.join(projectDir, configFileName);

  let timer: NodeJS.Timeout | undefined;
  const watcher = chokidar.watch([srcDir, configPath, behaviorDir], {
    ignoreInitial: true,
    ignored: (candidatePath) => isIgnoredPath(projectDir, candidatePath),
  });

  watcher.on("all", (_event, changedPath) => {
    if (!shouldRunBuild(projectDir, behaviorDir, changedPath)) {
      return;
    }
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

  await waitForWatcherReady(watcher);
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

function shouldRunBuild(projectDir: string, behaviorDir: string, changedPath: string): boolean {
  const resolvedPath = path.resolve(changedPath);
  const configPath = path.resolve(projectDir, configFileName);
  if (resolvedPath === configPath) {
    return true;
  }

  const srcDir = path.resolve(projectDir, "src");
  if (isInsidePath(srcDir, resolvedPath) && path.extname(resolvedPath) === ".ts") {
    return true;
  }

  return isInsidePath(path.resolve(behaviorDir), resolvedPath);
}

function isIgnoredPath(projectDir: string, candidatePath: string): boolean {
  const resolvedPath = path.resolve(candidatePath);
  return (
    isInsidePath(path.resolve(projectDir, internalOutDir), resolvedPath) ||
    isInsidePath(path.resolve(projectDir, "node_modules"), resolvedPath)
  );
}

function isInsidePath(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function waitForWatcherReady(watcher: FSWatcher): Promise<void> {
  return new Promise((resolve, reject) => {
    watcher.once("ready", resolve);
    watcher.once("error", reject);
  });
}
