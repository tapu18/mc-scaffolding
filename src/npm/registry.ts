import { CliError } from "../shared/errors.js";
import { isStableVersion, sortSemverDesc } from "./semver.js";
import type { MinecraftEdition, ScriptApiModule } from "../shared/types.js";
import {
  additionalScriptApiModuleCandidates,
  selectPreferredModuleVersion,
  selectServerVersionChoices,
  toScriptApiModule,
  type PackageVersionSnapshot,
} from "./module-selection.js";

interface Packument {
  name: string;
  versions: Record<string, unknown>;
  "dist-tags"?: Record<string, string>;
}

const registryBaseUrl = "https://registry.npmjs.org";
const registryRequestTimeoutMs = Number.parseInt(
  process.env.MC_SCAFFOLDING_NPM_REGISTRY_TIMEOUT_MS ?? "5000",
  10,
);

export interface ModuleVersionPolicy {
  edition: MinecraftEdition;
  allowBetaApis: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(registryRequestTimeoutMs),
    });
    if (!response.ok) {
      throw new CliError(`npm registry request failed: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof CliError) {
      throw error;
    }
    if (isAbortError(error)) {
      throw new CliError(`npm registry request timed out after ${registryRequestTimeoutMs}ms.`);
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new CliError(`npm registry request failed: ${message}`);
  }
}

export async function getPackageVersions(packageName: string): Promise<string[]> {
  return Object.keys((await getPackument(packageName)).versions ?? {});
}

async function getPackument(packageName: string): Promise<Packument> {
  const encodedName = packageName.replace("/", "%2F");
  return fetchJson<Packument>(`${registryBaseUrl}/${encodedName}`);
}

export async function getStableVersions(packageName: string): Promise<string[]> {
  return sortSemverDesc((await getPackageVersions(packageName)).filter(isStableVersion));
}

export async function getLatestStableVersion(packageName: string): Promise<string> {
  const stableVersions = await getStableVersions(packageName);
  if (stableVersions.length === 0) {
    throw new CliError(`No stable version found for ${packageName}`);
  }
  return stableVersions[0]!;
}

export async function getPreferredModule(packageName: string, policy: ModuleVersionPolicy): Promise<ScriptApiModule> {
  const version = await getPreferredModuleVersion(packageName, policy);
  return toScriptApiModule(packageName, version);
}

export async function getPreferredModuleVersion(
  packageName: string,
  policy: ModuleVersionPolicy,
): Promise<string> {
  const packument = await getPackument(packageName);
  return selectPreferredModuleVersion(packageName, toVersionSnapshot(packument), policy);
}

export async function getServerVersionChoices(policy: ModuleVersionPolicy): Promise<string[]> {
  const versions = await getPackageVersions("@minecraft/server");
  if (!policy.allowBetaApis) {
    return selectServerVersionChoices(versions, policy);
  }

  const preferred = await getPreferredModuleVersion("@minecraft/server", policy);
  return selectServerVersionChoices(versions, policy, preferred);
}

export async function getMinecraftModuleChoices(policy: ModuleVersionPolicy): Promise<ScriptApiModule[]> {
  const availableModules: ScriptApiModule[] = [];
  for (const name of additionalScriptApiModuleCandidates) {
    try {
      availableModules.push(await getPreferredModule(name, policy));
    } catch {
      // Ignore packages that disappear or cannot be inspected.
    }
  }

  return availableModules;
}

function toVersionSnapshot(packument: Packument): PackageVersionSnapshot {
  return {
    versions: Object.keys(packument.versions ?? {}),
    distTags: packument["dist-tags"],
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "TimeoutError";
}
