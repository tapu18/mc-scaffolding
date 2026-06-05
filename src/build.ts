import fs from "node:fs/promises";
import path from "node:path";
import { build as esbuild } from "esbuild";
import { internalOutDir } from "./config.js";
import { createManifest } from "./manifest.js";
import { syncPack } from "./sync.js";
import type { ScaffoldingConfig } from "./types.js";

export interface BuildOptions {
  sync: boolean;
}

export async function buildProject(
  projectDir: string,
  config: ScaffoldingConfig,
  options: BuildOptions,
): Promise<{ distDir: string; syncedTo?: string }> {
  const distDir = path.join(projectDir, internalOutDir);
  const entry = path.resolve(projectDir, config.entry ?? "src/main.ts");
  const scriptOutfile = path.join(distDir, "scripts", "main.js");

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(scriptOutfile), { recursive: true });

  await esbuild({
    entryPoints: [entry],
    outfile: scriptOutfile,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2020",
    external: ["@minecraft/*"],
    minify: config.build?.minify ?? false,
    sourcemap: config.build?.sourcemap ?? false,
    logLevel: "silent",
  });

  await fs.writeFile(
    path.join(distDir, "manifest.json"),
    `${JSON.stringify(createManifest(config), null, 2)}\n`,
  );

  if (!options.sync) {
    return { distDir };
  }

  return {
    distDir,
    syncedTo: await syncPack(projectDir, config),
  };
}
