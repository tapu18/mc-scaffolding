import { CliError } from "./errors.js";
import { isStableVersion, sortSemverDesc } from "./semver.js";

interface Packument {
  name: string;
  versions: Record<string, unknown>;
  "dist-tags"?: Record<string, string>;
}

interface SearchResponse {
  objects?: Array<{
    package?: {
      name?: string;
    };
  }>;
}

const registryBaseUrl = "https://registry.npmjs.org";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new CliError(`npm registry request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

export async function getPackageVersions(packageName: string): Promise<string[]> {
  const encodedName = packageName.replace("/", "%2F");
  const packument = await fetchJson<Packument>(`${registryBaseUrl}/${encodedName}`);
  return Object.keys(packument.versions ?? {});
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

export async function getServerVersionChoices(): Promise<string[]> {
  const versions = await getPackageVersions("@minecraft/server");
  const stableVersions = sortSemverDesc(versions.filter(isStableVersion)).slice(0, 5);
  const latestBeta = versions
    .filter((version) => version.includes("beta") || version.includes("-"))
    .sort()
    .at(-1);

  return [...stableVersions, ...(latestBeta ? [latestBeta] : [])];
}

export async function getMinecraftModuleChoices(): Promise<string[]> {
  const search = await fetchJson<SearchResponse>(
    `${registryBaseUrl}/-/v1/search?text=scope:minecraft&size=100`,
  );

  const names = new Set<string>();
  for (const item of search.objects ?? []) {
    const name = item.package?.name;
    if (name?.startsWith("@minecraft/") && name !== "@minecraft/server") {
      names.add(name);
    }
  }

  const stableNames: string[] = [];
  for (const name of [...names].sort()) {
    try {
      const stableVersions = await getStableVersions(name);
      if (stableVersions.length > 0) {
        stableNames.push(name);
      }
    } catch {
      // Ignore packages that disappear or cannot be inspected.
    }
  }

  return stableNames;
}
