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
  for (const [index, module] of config.scriptApi.modules.entries()) {
    assertScriptApiModule(module, `scriptApi.modules[${index}]`);
  }
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
  assertVersionTuple(config.manifest.minEngineVersion, "manifest.minEngineVersion");
  if (config.manifest.version !== undefined) {
    assertVersionTuple(config.manifest.version, "manifest.version");
  }
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

function assertScriptApiModule(module: unknown, pathLabel: string): asserts module is ScaffoldingConfig["scriptApi"]["modules"][number] {
  assertCli(module && typeof module === "object", `Config ${pathLabel} must be an object.`);
  const candidate = module as Partial<ScaffoldingConfig["scriptApi"]["modules"][number]>;
  assertCli(typeof candidate.name === "string" && candidate.name.length > 0, `Config ${pathLabel}.name must be a non-empty string.`);
  assertCli(typeof candidate.version === "string" && candidate.version.length > 0, `Config ${pathLabel}.version must be a non-empty string.`);
  if (candidate.manifestVersion !== undefined) {
    assertCli(typeof candidate.manifestVersion === "string" && candidate.manifestVersion.length > 0, `Config ${pathLabel}.manifestVersion must be a non-empty string.`);
  }
}

function assertVersionTuple(value: unknown, pathLabel: string): asserts value is [number, number, number] {
  assertCli(
    Array.isArray(value) &&
      value.length === 3 &&
      value.every((part) => Number.isInteger(part) && part >= 0),
    `Config ${pathLabel} must be a three-part non-negative integer array.`,
  );
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
