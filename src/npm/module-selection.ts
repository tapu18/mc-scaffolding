import { toManifestModuleVersion } from "../minecraft/manifest-version.js";
import { CliError } from "../shared/errors.js";
import { isStableVersion, sortSemverDesc } from "./semver.js";
import type { ScriptApiModule } from "../shared/types.js";
import type { ModuleVersionPolicy } from "./registry.js";

export interface PackageVersionSnapshot {
  versions: string[];
  distTags?: Record<string, string>;
}

export const additionalScriptApiModuleCandidates = [
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

export function toScriptApiModule(packageName: string, version: string): ScriptApiModule {
  return {
    name: packageName,
    version,
    manifestVersion: toManifestModuleVersion(version),
  };
}

export function selectPreferredModuleVersion(
  packageName: string,
  snapshot: PackageVersionSnapshot,
  policy: ModuleVersionPolicy,
): string {
  if (!policy.allowBetaApis) {
    const stableVersions = sortSemverDesc(snapshot.versions.filter(isStableVersion));
    if (stableVersions.length > 0) {
      return stableVersions[0]!;
    }
    throw new CliError(`No stable version found for ${packageName}`);
  }

  if (policy.edition === "bedrock") {
    const stableBetaVersion = getLatestStableBetaVersion(snapshot.versions);
    if (stableBetaVersion) {
      return stableBetaVersion;
    }
  }

  const betaVersion = snapshot.distTags?.beta;
  if (betaVersion) {
    return betaVersion;
  }

  const latestVersion = snapshot.distTags?.latest;
  if (latestVersion) {
    return latestVersion;
  }

  const lastVersion = snapshot.versions.at(-1);
  if (lastVersion) {
    return lastVersion;
  }

  throw new CliError(`No version found for ${packageName}`);
}

export function selectServerVersionChoices(
  versions: string[],
  policy: ModuleVersionPolicy,
  preferredVersion?: string,
): string[] {
  if (!policy.allowBetaApis) {
    return sortSemverDesc(versions.filter(isStableVersion)).slice(0, 5);
  }

  const stableVersions = sortSemverDesc(versions.filter(isStableVersion)).slice(0, 3);
  return [...new Set([...(preferredVersion ? [preferredVersion] : []), ...stableVersions])];
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
