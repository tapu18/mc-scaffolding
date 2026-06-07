import fs from "node:fs/promises";
import path from "node:path";
import { toManifestModuleVersion } from "../minecraft/manifest-version.js";
import type { ScaffoldingConfig } from "../shared/types.js";

interface BedrockManifest {
  format_version: 2;
  header: {
    name: string;
    description: string;
    uuid: string;
    version: [number, number, number];
    min_engine_version: [number, number, number];
  };
  modules: Array<{
    type: "script";
    language: "javascript";
    uuid: string;
    entry: string;
    version: [number, number, number];
  }>;
  dependencies: Array<{
    module_name: string;
    version: string;
  }>;
}

export function createManifest(config: ScaffoldingConfig): BedrockManifest {
  const version = config.manifest.version ?? [1, 0, 0];
  const manifest: BedrockManifest = {
    format_version: 2,
    header: {
      name: config.name,
      description: config.description ?? "",
      uuid: config.manifest.uuid,
      version,
      min_engine_version: config.manifest.minEngineVersion,
    },
    modules: [
      {
        type: "script",
        language: "javascript",
        uuid: config.manifest.moduleUuid,
        entry: "scripts/main.js",
        version,
      },
    ],
    dependencies: config.scriptApi.modules.map((module) => ({
      module_name: module.name,
      version: module.manifestVersion ?? toManifestModuleVersion(module.version),
    })),
  };

  return manifest;
}

export async function writeManifest(manifestPath: string, config: ScaffoldingConfig): Promise<string> {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(createManifest(config), null, 2)}\n`);
  return manifestPath;
}
