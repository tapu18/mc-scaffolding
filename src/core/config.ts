import path from "node:path";
import { createJiti } from "jiti";
import { assertCli } from "../shared/errors.js";
import type { ScaffoldingConfig } from "../shared/types.js";

export const configFileName = "scaffolding.config.ts";
export const internalOutDir = "dist";
export const behaviorSourceDir = "behavior";

export async function loadConfig(projectDir: string): Promise<ScaffoldingConfig> {
  const configPath = path.join(projectDir, configFileName);
  const jiti = createJiti(import.meta.url);
  const loaded = (await jiti.import(configPath)) as { default?: unknown } | unknown;
  const config = (typeof loaded === "object" && loaded && "default" in loaded
    ? (loaded as { default?: unknown }).default
    : loaded) as Partial<ScaffoldingConfig>;

  validateConfig(config);
  return normalizeConfig(config);
}

function validateConfig(config: Partial<ScaffoldingConfig>): asserts config is ScaffoldingConfig {
  assertCli(config && typeof config === "object", `${configFileName} must export a config object.`);
  assertCli(typeof config.name === "string" && config.name.length > 0, "Config requires name.");
  assertCli(config.scriptApi && Array.isArray(config.scriptApi.modules), "Config requires scriptApi.modules.");
  assertCli(
    config.scriptApi.modules.some((module) => module.name === "@minecraft/server"),
    "Config requires @minecraft/server in scriptApi.modules.",
  );
  assertCli(config.manifest && typeof config.manifest.uuid === "string", "Config requires manifest.uuid.");
  assertCli(
    config.manifest && typeof config.manifest.moduleUuid === "string",
    "Config requires manifest.moduleUuid.",
  );
  assertCli(
    config.manifest && Array.isArray(config.manifest.minEngineVersion),
    "Config requires manifest.minEngineVersion.",
  );
  assertCli(config.minecraft && typeof config.minecraft.edition === "string", "Config requires minecraft.edition.");
}

function normalizeConfig(config: ScaffoldingConfig): ScaffoldingConfig {
  return {
    ...config,
    description: config.description ?? "",
    entry: config.entry ?? "src/main.ts",
    manifest: {
      version: [1, 0, 0],
      ...config.manifest,
    },
    minecraft: {
      ...config.minecraft,
      packName: config.minecraft.packName ?? config.name,
    },
    build: {
      behaviorDir: behaviorSourceDir,
      minify: false,
      sourcemap: false,
      ...config.build,
    },
  };
}
