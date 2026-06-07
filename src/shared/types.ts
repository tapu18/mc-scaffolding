export type MinecraftEdition = "bedrock" | "preview";

export interface ScriptApiModule {
  name: string;
  version: string;
  manifestVersion?: string;
}

export interface ScaffoldingConfig {
  name: string;
  description?: string;
  entry?: string;
  scriptApi: {
    modules: ScriptApiModule[];
  };
  manifest: {
    uuid: string;
    moduleUuid: string;
    version?: [number, number, number];
    minEngineVersion: [number, number, number];
  };
  minecraft: {
    edition: MinecraftEdition;
    packName?: string;
    path?: string;
  };
  build?: {
    behaviorDir?: string;
    minify?: boolean;
    sourcemap?: boolean;
  };
}

export interface MinecraftPathCandidate {
  edition: MinecraftEdition;
  label: string;
  path: string;
  exists: boolean;
}
