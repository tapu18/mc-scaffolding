import { CliError } from "../shared/errors.js";

export type VersionTuple = [number, number, number];

export const fallbackMinEngineVersion: VersionTuple = [1, 26, 20];

const bedrockSamplesManifestUrl =
  "https://raw.githubusercontent.com/Mojang/bedrock-samples/main/behavior_pack/manifest.json";

interface SampleManifest {
  header?: {
    min_engine_version?: unknown;
  };
}

export async function resolveRecommendedMinEngineVersion(): Promise<VersionTuple> {
  try {
    const response = await fetch(bedrockSamplesManifestUrl, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new CliError(`Failed to fetch bedrock-samples manifest: ${response.status}`);
    }

    const manifest = (await response.json()) as SampleManifest;
    return parseVersionTuple(manifest.header?.min_engine_version);
  } catch {
    return fallbackMinEngineVersion;
  }
}

export function parseVersionTuple(value: unknown): VersionTuple {
  if (Array.isArray(value)) {
    const parts = value.map((part) =>
      typeof part === "number" ? part : Number.parseInt(String(part), 10),
    );
    if (parts.length === 3 && parts.every((part) => Number.isInteger(part) && part >= 0)) {
      return [parts[0]!, parts[1]!, parts[2]!];
    }
  }

  if (typeof value === "string") {
    const parts = value.split(".").map((part) => Number.parseInt(part, 10));
    if (parts.length === 3 && parts.every((part) => Number.isInteger(part) && part >= 0)) {
      return [parts[0]!, parts[1]!, parts[2]!];
    }
  }

  throw new CliError("Invalid version tuple.");
}

export function formatVersionTuple(version: VersionTuple): string {
  return version.join(".");
}
