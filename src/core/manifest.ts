import fs from "node:fs/promises";
import path from "node:path";
import { toManifestModuleVersion } from "../minecraft/manifest-version.js";
import type { ScriptApiModule } from "../shared/types.js";

export interface ManifestDefinition {
  name: string;
  description: string;
  uuid: string;
  moduleUuid: string;
  version: [number, number, number];
  minEngineVersion: [number, number, number];
  modules: ScriptApiModule[];
}

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

export function createManifest(definition: ManifestDefinition): BedrockManifest {
  const manifest: BedrockManifest = {
    format_version: 2,
    header: {
      name: definition.name,
      description: definition.description,
      uuid: definition.uuid,
      version: definition.version,
      min_engine_version: definition.minEngineVersion,
    },
    modules: [
      {
        type: "script",
        language: "javascript",
        uuid: definition.moduleUuid,
        entry: "scripts/main.js",
        version: definition.version,
      },
    ],
    dependencies: definition.modules.map((module) => ({
      module_name: module.name,
      version: module.manifestVersion ?? toManifestModuleVersion(module.version),
    })),
  };

  return manifest;
}

export async function writeManifest(manifestPath: string, definition: ManifestDefinition): Promise<string> {
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(createManifest(definition), null, 2)}\n`);
  return manifestPath;
}
