import type { ScaffoldingConfig } from "./types.js";

interface BedrockManifest {
  format_version: 2;
  header: {
    name: string;
    description: string;
    uuid: string;
    version: [number, number, number];
    min_engine_version?: [number, number, number];
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
      version: module.version,
    })),
  };

  if (Array.isArray(config.manifest.minEngineVersion)) {
    manifest.header.min_engine_version = config.manifest.minEngineVersion;
  }

  return manifest;
}
