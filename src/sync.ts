import fs from "node:fs/promises";
import path from "node:path";
import { internalOutDir } from "./config.js";
import { assertCli } from "./errors.js";
import { resolveMinecraftPath } from "./minecraft-paths.js";
import type { ScaffoldingConfig } from "./types.js";

export async function syncPack(projectDir: string, config: ScaffoldingConfig): Promise<string> {
  const distDir = path.join(projectDir, internalOutDir);
  const minecraftPath = path.resolve(await resolveMinecraftPath(config));
  const packName = config.minecraft.packName ?? config.name;
  const targetDir = resolveSyncTarget(minecraftPath, packName);

  assertCli(await pathExists(distDir), "dist does not exist. Run build first.");

  await fs.mkdir(minecraftPath, { recursive: true });
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(distDir, targetDir, { recursive: true });

  return targetDir;
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
