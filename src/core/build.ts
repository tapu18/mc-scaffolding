import fs from "node:fs/promises";
import path from "node:path";
import { build as esbuild } from "esbuild";
import { resolveExistingBehaviorDir } from "./behavior.js";
import { behaviorSourceDir, internalOutDir } from "./config.js";
import { assertCli } from "../shared/errors.js";
import { syncPack } from "./sync.js";
import type { ScaffoldingConfig } from "../shared/types.js";

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
  const debugSourcemapOutfile = path.join(distDir, "debug", "main.js.map");

  await resolveExistingBehaviorDir(projectDir, config.build?.behaviorDir ?? behaviorSourceDir);
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(scriptOutfile), { recursive: true });

  await buildScript(entry, scriptOutfile, debugSourcemapOutfile, config);

  if (!options.sync) {
    return { distDir };
  }

  return {
    distDir,
    syncedTo: await syncPack(projectDir, config),
  };
}

async function buildScript(
  entry: string,
  scriptOutfile: string,
  debugSourcemapOutfile: string,
  config: ScaffoldingConfig,
): Promise<void> {
  const sourcemap = config.build?.sourcemap ?? false;
  const result = await esbuild({
    entryPoints: [entry],
    outfile: scriptOutfile,
    bundle: true,
    format: "esm",
    platform: "neutral",
    target: "es2020",
    external: ["@minecraft/*"],
    minify: config.build?.minify ?? false,
    sourcemap: sourcemap ? "external" : false,
    write: false,
    logLevel: "silent",
  });

  for (const outputFile of result.outputFiles) {
    const outputPath = path.resolve(outputFile.path);
    if (outputPath === path.resolve(scriptOutfile)) {
      await writeGeneratedScript(scriptOutfile, outputFile.contents, sourcemap ? debugSourcemapOutfile : undefined);
      continue;
    }

    if (outputPath === path.resolve(`${scriptOutfile}.map`)) {
      await writeGeneratedSourcemap(debugSourcemapOutfile, outputFile.contents, scriptOutfile);
      continue;
    }

    await writeGeneratedFile(outputPath, outputFile.contents);
  }

  assertCli(await pathExists(scriptOutfile), "esbuild did not emit scripts/main.js.");
  if (sourcemap) {
    assertCli(await pathExists(debugSourcemapOutfile), "esbuild did not emit debug/main.js.map.");
  }
}

async function writeGeneratedScript(
  scriptOutfile: string,
  contents: Uint8Array,
  sourcemapOutfile?: string,
): Promise<void> {
  if (!sourcemapOutfile) {
    await writeGeneratedFile(scriptOutfile, contents);
    return;
  }

  const sourceMappingUrl = toPosixPath(path.relative(path.dirname(scriptOutfile), sourcemapOutfile));
  const script = `${Buffer.from(contents).toString("utf8")}\n//# sourceMappingURL=${sourceMappingUrl}\n`;
  await writeGeneratedFile(scriptOutfile, script);
}

async function writeGeneratedSourcemap(
  sourcemapOutfile: string,
  contents: Uint8Array,
  scriptOutfile: string,
): Promise<void> {
  const sourcemap = JSON.parse(Buffer.from(contents).toString("utf8")) as Record<string, unknown>;
  sourcemap.file = toPosixPath(path.relative(path.dirname(sourcemapOutfile), scriptOutfile));
  await writeGeneratedFile(sourcemapOutfile, `${JSON.stringify(sourcemap)}\n`);
}

async function writeGeneratedFile(outfile: string, contents: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(outfile), { recursive: true });
  await fs.writeFile(outfile, contents);
}

function toPosixPath(candidatePath: string): string {
  return candidatePath.split(path.sep).join("/");
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}
