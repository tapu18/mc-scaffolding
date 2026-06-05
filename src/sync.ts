import fs from "node:fs/promises";
import path from "node:path";
import { internalOutDir } from "./config.js";
import { assertCli } from "./errors.js";
import { resolveMinecraftPath } from "./minecraft-paths.js";
import type { ScaffoldingConfig } from "./types.js";

export async function syncPack(projectDir: string, config: ScaffoldingConfig): Promise<string> {
  const distDir = path.join(projectDir, internalOutDir);
  const minecraftPath = await resolveMinecraftPath(config);
  const packName = config.minecraft.packName ?? config.name;
  const targetDir = path.join(minecraftPath, packName);

  assertCli(await pathExists(distDir), "dist does not exist. Run build first.");

  await fs.mkdir(minecraftPath, { recursive: true });
  await fs.rm(targetDir, { recursive: true, force: true });
  await fs.cp(distDir, targetDir, { recursive: true });

  return targetDir;
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
