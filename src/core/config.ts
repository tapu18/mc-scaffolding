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
  assertCli(config.minecraft && typeof config.minecraft.edition === "string", "Config requires minecraft.edition.");
  assertCli(
    config.minecraft.edition === "bedrock" || config.minecraft.edition === "preview",
    "Config minecraft.edition must be either bedrock or preview.",
  );
  if (config.minecraft.packName !== undefined) {
    assertCli(typeof config.minecraft.packName === "string", "Config minecraft.packName must be a string.");
  }
  if (config.minecraft.path !== undefined) {
    assertCli(typeof config.minecraft.path === "string", "Config minecraft.path must be a string.");
  }
  if (config.entry !== undefined) {
    assertCli(typeof config.entry === "string" && config.entry.length > 0, "Config entry must be a non-empty string.");
  }
  if (config.description !== undefined) {
    assertCli(typeof config.description === "string", "Config description must be a string.");
  }
  if (config.build !== undefined) {
    assertBuildConfig(config.build);
  }
}

function assertBuildConfig(build: NonNullable<ScaffoldingConfig["build"]>): void {
  if (build.behaviorDir !== undefined) {
    assertCli(typeof build.behaviorDir === "string" && build.behaviorDir.length > 0, "Config build.behaviorDir must be a non-empty string.");
  }
  if (build.minify !== undefined) {
    assertCli(typeof build.minify === "boolean", "Config build.minify must be a boolean.");
  }
  if (build.sourcemap !== undefined) {
    assertCli(typeof build.sourcemap === "boolean", "Config build.sourcemap must be a boolean.");
  }
}

function normalizeConfig(config: ScaffoldingConfig): ScaffoldingConfig {
  return {
    ...config,
    description: config.description ?? "",
    entry: config.entry ?? "src/main.ts",
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
