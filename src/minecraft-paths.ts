import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { CliError } from "./errors.js";
import { loadUserConfig } from "./user-config.js";
import type { MinecraftEdition, MinecraftPathCandidate, ScaffoldingConfig } from "./types.js";

const developmentBehaviorPacks = "development_behavior_packs";

export function getDefaultMinecraftPathCandidates(): MinecraftPathCandidate[] {
  return getCandidatePaths();
}

export async function resolveMinecraftPath(config: ScaffoldingConfig): Promise<string> {
  if (config.minecraft.path) {
    return path.resolve(config.minecraft.path);
  }

  const defaultPath = (await loadUserConfig()).minecraft?.[config.minecraft.edition];
  if (defaultPath) {
    return path.resolve(defaultPath);
  }

  const candidate = getDefaultMinecraftPathCandidates().find(
    (candidate) => candidate.edition === config.minecraft.edition && candidate.exists,
  );
  if (candidate) {
    return path.resolve(candidate.path);
  }

  throw new CliError(
    `Could not resolve Minecraft ${config.minecraft.edition} development_behavior_packs path. Set minecraft.path in scaffolding.config.ts or run mc-scaffolding config set-path.`,
  );
}

function getCandidatePaths(): MinecraftPathCandidate[] {
  const candidates: MinecraftPathCandidate[] = [];

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    if (appData) {
      candidates.push(
        candidate(
          "bedrock",
          path.join(
            appData,
            "Minecraft Bedrock",
            "Users",
            "Shared",
            "games",
            "com.mojang",
            developmentBehaviorPacks,
          ),
          "Minecraft Bedrock",
        ),
        candidate(
          "preview",
          path.join(
            appData,
            "Minecraft Bedrock Preview",
            "Users",
            "Shared",
            "games",
            "com.mojang",
            developmentBehaviorPacks,
          ),
          "Minecraft Preview",
        ),
      );
    }
  }

  return candidates;
}

function candidate(
  edition: MinecraftEdition,
  candidatePath: string,
  label: string,
): MinecraftPathCandidate {
  return {
    edition,
    label,
    path: candidatePath,
    exists: directoryExists(candidatePath),
  };
}

function directoryExists(candidatePath: string): boolean {
  try {
    return fs.statSync(candidatePath).isDirectory();
  } catch {
    return false;
  }
}
