import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { MinecraftEdition } from "./types.js";

export interface UserConfig {
  minecraft?: Partial<Record<MinecraftEdition, string>>;
}

export function getUserConfigPath(): string {
  const configHome = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(configHome, "mc-scaffolding", "config.json");
}

export async function loadUserConfig(): Promise<UserConfig> {
  const configPath = getUserConfigPath();
  try {
    const content = await fs.readFile(configPath, "utf8");
    const parsed = JSON.parse(content) as UserConfig;
    return normalizeUserConfig(parsed);
  } catch (error) {
    if (isNotFoundError(error)) {
      return {};
    }
    throw error;
  }
}

export async function saveUserConfig(config: UserConfig): Promise<string> {
  const configPath = getUserConfigPath();
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(normalizeUserConfig(config), null, 2)}\n`);
  return configPath;
}

export async function setDefaultMinecraftPath(
  edition: MinecraftEdition,
  minecraftPath: string,
): Promise<string> {
  const config = await loadUserConfig();
  config.minecraft = {
    ...config.minecraft,
    [edition]: minecraftPath,
  };
  return saveUserConfig(config);
}

export async function clearDefaultMinecraftPath(edition: MinecraftEdition): Promise<string> {
  const config = await loadUserConfig();
  if (config.minecraft) {
    delete config.minecraft[edition];
  }
  return saveUserConfig(config);
}

function normalizeUserConfig(config: UserConfig): UserConfig {
  const minecraft = config.minecraft ?? {};
  return {
    minecraft: {
      ...(minecraft.bedrock ? { bedrock: minecraft.bedrock } : {}),
      ...(minecraft.preview ? { preview: minecraft.preview } : {}),
    },
  };
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
