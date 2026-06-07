import path from "node:path";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { getDefaultMinecraftPathCandidates } from "../minecraft/paths.js";
import {
  getMinecraftModuleChoices,
  getServerVersionChoices,
  type ModuleVersionPolicy,
} from "../npm/registry.js";
import {
  formatVersionTuple,
  parseVersionTuple,
  resolveRecommendedMinEngineVersion,
  type VersionTuple,
} from "../minecraft/platform-version.js";
import { loadUserConfig } from "../commands/user-config.js";
import { CliError, assertCli } from "../shared/errors.js";
import type {
  MinecraftEdition,
  MinecraftPathCandidate,
  ScriptApiModule,
} from "../shared/types.js";
import { sanitizePackageName } from "./templates.js";

export interface InitAnswers {
  name: string;
  description: string;
  edition: MinecraftEdition;
  minecraftPath?: string;
  allowBetaApis: boolean;
  serverVersion: string;
  additionalModules: ScriptApiModule[];
  minEngineVersion: VersionTuple;
}

export async function promptForInit(projectDir: string): Promise<InitAnswers> {
  const defaultName = sanitizePackageName(path.basename(projectDir)) || "my-addon";
  const name = await input({
    message: "Pack name",
    default: defaultName,
    required: true,
  });

  const description = await input({
    message: "Description",
    default: "My Bedrock Script API addon",
  });

  const pathCandidates = await getInitMinecraftPathCandidates();
  const edition = await promptEdition(pathCandidates);
  const minecraftPath = await promptMinecraftPath(pathCandidates, edition);
  const allowBetaApis = await promptAllowBetaApis();
  const moduleVersionPolicy = { edition, allowBetaApis };
  const serverVersion = await promptServerVersion(moduleVersionPolicy);
  const additionalModules = await promptAdditionalModules(moduleVersionPolicy);
  const minEngineVersion = await promptMinEngineVersion();

  return {
    name,
    description,
    edition,
    minecraftPath,
    allowBetaApis,
    serverVersion,
    additionalModules,
    minEngineVersion,
  };
}

async function getInitMinecraftPathCandidates(): Promise<MinecraftPathCandidate[]> {
  const userConfig = await loadUserConfig();
  const userCandidates = Object.entries(userConfig.minecraft ?? {}).map(([edition, configuredPath]) => ({
    edition: edition as MinecraftEdition,
    label: `Configured ${edition}`,
    path: configuredPath,
    exists: true,
  }));
  return dedupePathCandidates([...userCandidates, ...getDefaultMinecraftPathCandidates()]);
}

function dedupePathCandidates(candidates: MinecraftPathCandidate[]): MinecraftPathCandidate[] {
  const seen = new Set<string>();
  const uniqueCandidates: MinecraftPathCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.edition}:${path.resolve(candidate.path)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates;
}

async function promptAllowBetaApis(): Promise<boolean> {
  return confirm({
    message: "Allow beta Script API modules?",
    default: false,
  });
}

async function promptMinEngineVersion(): Promise<VersionTuple> {
  const recommended = await resolveRecommendedMinEngineVersion();
  return parseMinEngineVersion(
    await input({
      message: "min_engine_version",
      default: formatVersionTuple(recommended),
      required: true,
    }),
  );
}

async function promptEdition(candidates: MinecraftPathCandidate[]): Promise<MinecraftEdition> {
  const defaultEdition = candidates.find((candidate) => candidate.exists)?.edition ?? "bedrock";

  return select<MinecraftEdition>({
    message: "Minecraft edition",
    choices: [
      { name: "Minecraft Bedrock", value: "bedrock" },
      { name: "Minecraft Preview", value: "preview" },
    ],
    default: defaultEdition,
  });
}

async function promptMinecraftPath(
  candidates: MinecraftPathCandidate[],
  edition: MinecraftEdition,
): Promise<string | undefined> {
  const matchingCandidates = candidates.filter((candidate) => candidate.edition === edition);
  if (matchingCandidates.length === 1) {
    return input({
      message: "development_behavior_packs path",
      default: matchingCandidates[0]!.path,
      required: true,
    });
  }

  if (matchingCandidates.length > 1) {
    return select<string>({
      message: "development_behavior_packs path",
      choices: matchingCandidates.map((candidate) => ({
        name: `${candidate.label}: ${candidate.path}`,
        value: candidate.path,
      })),
      default: matchingCandidates[0]!.path,
    });
  }

  return input({
    message: "development_behavior_packs path",
    required: true,
  });
}

async function promptServerVersion(policy: ModuleVersionPolicy): Promise<string> {
  const choices = await getServerVersionChoices(policy);
  assertCli(choices.length > 0, "Could not resolve @minecraft/server versions from npm.");

  return select<string>({
    message: "@minecraft/server version",
    choices: choices.map((version, index) => ({
      name: index === 0 ? `${version} (recommended)` : version,
      value: version,
    })),
    default: choices[0],
  });
}

async function promptAdditionalModules(policy: ModuleVersionPolicy): Promise<ScriptApiModule[]> {
  let modules: ScriptApiModule[] = [];
  try {
    modules = await getMinecraftModuleChoices(policy);
  } catch {
    modules = [];
  }

  if (modules.length === 0) {
    return [];
  }

  return checkbox<string>({
    message: "Additional Script API modules",
    choices: modules.map((module) => ({
      name: formatAdditionalModuleChoice(module),
      value: module.name,
    })),
  }).then((selectedNames) =>
    modules.filter((module) => selectedNames.includes(module.name)),
  );
}

function formatAdditionalModuleChoice(module: ScriptApiModule): string {
  const moduleName = module.name;
  const suffix = `npm ${module.version}, manifest ${module.manifestVersion}`;
  if (moduleName === "@minecraft/server-ui") {
    return `${moduleName} - forms and UI (${suffix})`;
  }
  if (moduleName === "@minecraft/server-gametest") {
    return `${moduleName} - GameTest APIs (${suffix})`;
  }
  return `${moduleName} (${suffix})`;
}

function parseMinEngineVersion(value: string): VersionTuple {
  const trimmed = value.trim();
  try {
    return parseVersionTuple(trimmed);
  } catch {
    throw new CliError("min_engine_version must use x.y.z format.");
  }
}
