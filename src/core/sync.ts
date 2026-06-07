import fs from "node:fs/promises";
import path from "node:path";
import { resolveExistingBehaviorDir } from "./behavior.js";
import { behaviorSourceDir, internalOutDir } from "./config.js";
import { assertCli } from "../shared/errors.js";
import { resolveMinecraftPath } from "../minecraft/paths.js";
import type { ScaffoldingConfig } from "../shared/types.js";

export async function syncPack(projectDir: string, config: ScaffoldingConfig): Promise<string> {
  const distDir = path.join(projectDir, internalOutDir);
  const behaviorDir = await resolveExistingBehaviorDir(
    projectDir,
    config.build?.behaviorDir ?? behaviorSourceDir,
  );
  const minecraftPath = path.resolve(await resolveMinecraftPath(config));
  const packName = config.minecraft.packName ?? config.name;
  const targetDir = resolveSyncTarget(minecraftPath, packName);

  assertCli(await pathExists(distDir), "dist does not exist. Run build first.");

  await fs.mkdir(minecraftPath, { recursive: true });
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(behaviorDir, targetDir, { recursive: true });
  await copyGeneratedOutput(distDir, targetDir);

  return targetDir;
}

async function copyGeneratedOutput(distDir: string, targetDir: string): Promise<void> {
  await copyGeneratedDirectory(distDir, targetDir, "scripts", { required: true });
  await copyGeneratedDirectory(distDir, targetDir, "debug", { required: false });
}

async function copyGeneratedDirectory(
  distDir: string,
  targetDir: string,
  relativeDir: string,
  options: { required: boolean },
): Promise<void> {
  const sourceDir = path.join(distDir, relativeDir);
  if (!(await pathExists(sourceDir))) {
    assertCli(!options.required, `dist/${relativeDir} does not exist. Run build first.`);
    return;
  }
  await fs.cp(sourceDir, path.join(targetDir, relativeDir), { recursive: true });
}

function resolveSyncTarget(minecraftPath: string, packName: string): string {
  assertCli(isSingleDirectoryName(packName), "minecraft.packName must be a single directory name.");

  const targetDir = path.resolve(minecraftPath, packName);
  const relativeTarget = path.relative(minecraftPath, targetDir);

  assertCli(
    relativeTarget !== "" && !isOutsidePath(relativeTarget) && !path.isAbsolute(relativeTarget),
    "Resolved sync target must be inside the Minecraft development_behavior_packs directory.",
  );

  return targetDir;
}

function isSingleDirectoryName(value: string): boolean {
  return (
    value.trim().length > 0 &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !path.isAbsolute(value)
  );
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
