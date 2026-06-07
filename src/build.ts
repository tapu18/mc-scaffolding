import fs from "node:fs/promises";
import path from "node:path";
import { build as esbuild } from "esbuild";
import { behaviorSourceDir, internalOutDir } from "./config.js";
import { assertCli } from "./errors.js";
import { syncPack } from "./sync.js";
import type { ScaffoldingConfig } from "./types.js";

export interface BuildOptions {
  sync: boolean;
}

export async function buildProject(
  projectDir: string,
  config: ScaffoldingConfig,
  options: BuildOptions,
): Promise<{ distDir: string; syncedTo?: string }> {
  const distDir = path.join(projectDir, internalOutDir);
  const entry = path.resolve(projectDir, config.entry ?? "src/main.ts");
  const scriptOutfile = path.join(distDir, "scripts", "main.js");
  const behaviorDir = resolveBehaviorDir(projectDir, config.build?.behaviorDir ?? behaviorSourceDir);

  await assertBehaviorDir(behaviorDir);
  await fs.rm(distDir, { recursive: true, force: true });
  await copyBehaviorFiles(behaviorDir, distDir);
  await fs.mkdir(path.dirname(scriptOutfile), { recursive: true });

  await esbuild({
    entryPoints: [entry],
    outfile: scriptOutfile,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2020",
    external: ["@minecraft/*"],
    minify: config.build?.minify ?? false,
    sourcemap: config.build?.sourcemap ?? false,
    logLevel: "silent",
  });

  if (!options.sync) {
    return { distDir };
  }

  return {
    distDir,
    syncedTo: await syncPack(projectDir, config),
  };
}

async function copyBehaviorFiles(behaviorDir: string, distDir: string): Promise<void> {
  await fs.cp(behaviorDir, distDir, { recursive: true });
}

async function assertBehaviorDir(behaviorDir: string): Promise<void> {
  assertCli(await pathExists(behaviorDir), "build.behaviorDir does not exist.");
  const behaviorStat = await fs.stat(behaviorDir);
  assertCli(behaviorStat.isDirectory(), "build.behaviorDir must point to a directory.");
}

function resolveBehaviorDir(projectDir: string, behaviorDir: string): string {
  assertCli(behaviorDir.trim().length > 0, "build.behaviorDir must not be empty.");
  assertCli(!path.isAbsolute(behaviorDir), "build.behaviorDir must be relative to the project directory.");

  const resolvedProjectDir = path.resolve(projectDir);
  const resolvedBehaviorDir = path.resolve(resolvedProjectDir, behaviorDir);
  const relativeBehaviorDir = path.relative(resolvedProjectDir, resolvedBehaviorDir);

  assertCli(
    relativeBehaviorDir !== "" &&
      !isOutsidePath(relativeBehaviorDir) &&
      !path.isAbsolute(relativeBehaviorDir),
    "build.behaviorDir must resolve inside the project directory.",
  );

  const relativeOutDir = path.relative(path.resolve(resolvedProjectDir, internalOutDir), resolvedBehaviorDir);
  assertCli(
    isOutsidePath(relativeOutDir) || path.isAbsolute(relativeOutDir),
    "build.behaviorDir must not be inside dist.",
  );

  return resolvedBehaviorDir;
}

function isOutsidePath(relativePath: string): boolean {
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`);
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
