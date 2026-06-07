import { CliError } from "./errors.js";
import { toManifestModuleVersion } from "./manifest-version.js";
import { isStableVersion, sortSemverDesc } from "./semver.js";
import type { MinecraftEdition, ScriptApiModule } from "./types.js";

interface Packument {
  name: string;
  versions: Record<string, unknown>;
  "dist-tags"?: Record<string, string>;
}

const registryBaseUrl = "https://registry.npmjs.org";
const additionalScriptApiModuleCandidates = [
  "@minecraft/server-ui",
  "@minecraft/server-gametest",
  "@minecraft/server-admin",
  "@minecraft/server-net",
  "@minecraft/server-editor",
  "@minecraft/server-graphics",
  "@minecraft/common",
  "@minecraft/debug-utilities",
  "@minecraft/diagnostics",
];

export interface ModuleVersionPolicy {
  edition: MinecraftEdition;
  allowBetaApis: boolean;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new CliError(`npm registry request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
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
  return {
    name: packageName,
    version,
    manifestVersion: toManifestModuleVersion(version),
  };
}

export async function getPreferredModuleVersion(
  packageName: string,
  policy: ModuleVersionPolicy,
): Promise<string> {
  const packument = await getPackument(packageName);
  const versions = Object.keys(packument.versions ?? {});

  if (!policy.allowBetaApis) {
    const stableVersions = sortSemverDesc(versions.filter(isStableVersion));
    if (stableVersions.length > 0) {
      return stableVersions[0]!;
    }
    throw new CliError(`No stable version found for ${packageName}`);
  }

  if (policy.edition === "bedrock") {
    const stableBetaVersion = getLatestStableBetaVersion(versions);
    if (stableBetaVersion) {
      return stableBetaVersion;
    }
  }

  const betaVersion = packument["dist-tags"]?.beta;
  if (betaVersion) {
    return betaVersion;
  }

  const latestVersion = packument["dist-tags"]?.latest;
  if (latestVersion) {
    return latestVersion;
  }
  const lastVersion = versions.at(-1);
  if (lastVersion) {
    return lastVersion;
  }

  throw new CliError(`No version found for ${packageName}`);
}

export async function getServerVersionChoices(policy: ModuleVersionPolicy): Promise<string[]> {
  const versions = await getPackageVersions("@minecraft/server");
  if (!policy.allowBetaApis) {
    return sortSemverDesc(versions.filter(isStableVersion)).slice(0, 5);
  }

  const preferred = await getPreferredModuleVersion("@minecraft/server", policy);
  const stableVersions = sortSemverDesc(versions.filter(isStableVersion)).slice(0, 3);

  return [...new Set([preferred, ...stableVersions])];
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

function getLatestStableBetaVersion(versions: string[]): string | undefined {
  const stableBetaVersions = versions.filter((version) => version.includes("-beta.") && version.includes("-stable"));
  return stableBetaVersions.sort(compareMinecraftPackageVersionDesc)[0];
}

function compareMinecraftPackageVersionDesc(a: string, b: string): number {
  const productA = getEmbeddedProductVersion(a);
  const productB = getEmbeddedProductVersion(b);
  if (productA && productB) {
    for (let index = 0; index < 3; index += 1) {
      const difference = productB[index]! - productA[index]!;
      if (difference !== 0) {
        return difference;
      }
    }
  }
  return b.localeCompare(a, undefined, { numeric: true });
}

function getEmbeddedProductVersion(version: string): [number, number, number] | undefined {
  const match = version.match(/(\d+)\.(\d+)\.(\d+)-(?:stable|preview)/);
  if (!match) {
    return undefined;
  }

  return [
    Number.parseInt(match[1]!, 10),
    Number.parseInt(match[2]!, 10),
    Number.parseInt(match[3]!, 10),
  ];
}
