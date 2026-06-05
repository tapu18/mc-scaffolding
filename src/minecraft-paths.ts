import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { CliError } from "./errors.js";
import type { MinecraftEdition, MinecraftPathCandidate, ScaffoldingConfig } from "./types.js";

const developmentBehaviorPacks = "development_behavior_packs";

export async function detectMinecraftPaths(): Promise<MinecraftPathCandidate[]> {
  const candidates = getCandidatePaths();
  return Promise.all(
    candidates.map(async (candidate) => ({
      ...candidate,
      exists: await pathExists(candidate.path),
    })),
  );
}

export async function resolveMinecraftPath(config: ScaffoldingConfig): Promise<string> {
  if (config.minecraft.path) {
    return path.resolve(config.minecraft.path);
  }

  const candidates = (await detectMinecraftPaths()).filter(
    (candidate) => candidate.edition === config.minecraft.edition && candidate.exists,
  );

  if (candidates.length > 0) {
    return candidates[0]!.path;
  }

  throw new CliError(
    `Could not detect Minecraft ${config.minecraft.edition} development_behavior_packs path. Set minecraft.path in scaffolding.config.ts.`,
  );
}

function getCandidatePaths(): MinecraftPathCandidate[] {
  const candidates: MinecraftPathCandidate[] = [];

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      candidates.push(
        windowsCandidate(
          "bedrock",
          localAppData,
          "Microsoft.MinecraftUWP_8wekyb3d8bbwe",
          "Minecraft Bedrock",
        ),
        windowsCandidate(
          "preview",
          localAppData,
          "Microsoft.MinecraftWindowsBeta_8wekyb3d8bbwe",
          "Minecraft Preview",
        ),
      );
    }
  }

  if (process.platform === "linux") {
    const home = os.homedir();
    candidates.push(
      linuxCandidate(
        "bedrock",
        path.join(home, ".local/share/mcpelauncher/games/com.mojang", developmentBehaviorPacks),
        "mcpelauncher Bedrock",
      ),
      linuxCandidate(
        "preview",
        path.join(home, ".local/share/mcpelauncher-preview/games/com.mojang", developmentBehaviorPacks),
        "mcpelauncher Preview",
      ),
      linuxCandidate(
        "bedrock",
        path.join(home, ".var/app/io.mrarm.mcpelauncher/data/mcpelauncher/games/com.mojang", developmentBehaviorPacks),
        "Flatpak mcpelauncher Bedrock",
      ),
    );
  }

  return candidates;
}

function windowsCandidate(
  edition: MinecraftEdition,
  localAppData: string,
  packageDir: string,
  label: string,
): MinecraftPathCandidate {
  return {
    edition,
    label,
    path: path.join(
      localAppData,
      "Packages",
      packageDir,
      "LocalState",
      "games",
      "com.mojang",
      developmentBehaviorPacks,
    ),
    exists: false,
  };
}

function linuxCandidate(
  edition: MinecraftEdition,
  candidatePath: string,
  label: string,
): MinecraftPathCandidate {
  return {
    edition,
    label,
    path: candidatePath,
    exists: false,
  };
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
