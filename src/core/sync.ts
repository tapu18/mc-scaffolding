import fs from "node:fs/promises";
import path from "node:path";
import { resolveExistingBehaviorDir } from "./behavior.js";
import { behaviorSourceDir, internalOutDir } from "./config.js";
import { CliError, assertCli } from "../shared/errors.js";
import { resolveMinecraftPath } from "../minecraft/paths.js";
import type { ScaffoldingConfig } from "../shared/types.js";

const markerFileName = ".mc-scaffolding.json";

interface SyncMarker {
  tool: "mc-scaffolding";
  version: 1;
  projectDir: string;
  packName: string;
}

export interface SyncOptions {
  force?: boolean;
  dryRun?: boolean;
}

export interface SyncResult {
  targetDir: string;
  dryRun: boolean;
  actions: string[];
}

export async function syncPack(
  projectDir: string,
  config: ScaffoldingConfig,
  options: SyncOptions = {},
): Promise<SyncResult> {
  const distDir = path.join(projectDir, internalOutDir);
  const behaviorDir = await resolveExistingBehaviorDir(
    projectDir,
    config.build?.behaviorDir ?? behaviorSourceDir,
  );
  const minecraftPath = path.resolve(await resolveMinecraftPath(config));
  const packName = config.minecraft.packName ?? config.name;
  const targetDir = resolveSyncTarget(minecraftPath, packName);
  const marker = createMarker(projectDir, packName);
  const dryRun = options.dryRun ?? false;
  const actions: string[] = [];

  assertCli(await pathExists(distDir), "dist does not exist. Run build first.");
  await assertGeneratedOutput(distDir);
  assertDevelopmentBehaviorPacksPath(minecraftPath);
  await assertExistingDirectory(minecraftPath, "Minecraft development_behavior_packs path");
  await validateSyncTarget(targetDir, marker, { force: options.force ?? false });

  actions.push(`${await pathExists(targetDir) ? "replace" : "create"} ${targetDir}`);
  actions.push(`copy ${behaviorDir}`);
  actions.push(`copy ${path.join(distDir, "scripts")}`);
  if (await pathExists(path.join(distDir, "debug"))) {
    actions.push(`copy ${path.join(distDir, "debug")}`);
  }
  actions.push(`write ${path.join(targetDir, markerFileName)}`);

  if (dryRun) {
    return { targetDir, dryRun, actions };
  }

  await replaceTargetContents(distDir, behaviorDir, targetDir, marker);

  return { targetDir, dryRun, actions };
}

async function assertGeneratedOutput(distDir: string): Promise<void> {
  assertCli(await pathExists(path.join(distDir, "scripts")), "dist/scripts does not exist. Run build first.");
}

async function replaceTargetContents(
  distDir: string,
  behaviorDir: string,
  targetDir: string,
  marker: SyncMarker,
): Promise<void> {
  try {
    await fs.mkdir(targetDir, { recursive: true });
    await emptyDirectory(targetDir);
    await fs.cp(behaviorDir, targetDir, { recursive: true });
    await copyGeneratedOutput(distDir, targetDir);
    await writeMarker(targetDir, marker);
  } catch (error) {
    if (isWindowsAccessError(error)) {
      throw new CliError(
        `Could not sync target because Windows denied access. Close Minecraft, Explorer, or editors using the pack directory, then retry: ${targetDir}`,
      );
    }
    throw error;
  }
}

async function emptyDirectory(directoryPath: string): Promise<void> {
  for (const entry of await fs.readdir(directoryPath)) {
    await fs.rm(path.join(directoryPath, entry), { recursive: true, force: true });
  }
}

async function copyGeneratedOutput(distDir: string, targetDir: string): Promise<void> {
  await copyGeneratedDirectory(distDir, targetDir, "scripts", { required: true });
  await copyGeneratedDirectory(distDir, targetDir, "debug", { required: false });
}

async function copyGeneratedDirectory(
  distDir: string,
  targetDir: string,
  relativeDir: string,
  options: { required: boolean },
): Promise<void> {
  const sourceDir = path.join(distDir, relativeDir);
  if (!(await pathExists(sourceDir))) {
    assertCli(!options.required, `dist/${relativeDir} does not exist. Run build first.`);
    return;
  }
  await fs.cp(sourceDir, path.join(targetDir, relativeDir), { recursive: true });
}

async function validateSyncTarget(
  targetDir: string,
  marker: SyncMarker,
  options: { force: boolean },
): Promise<void> {
  if (!(await pathExists(targetDir))) {
    return;
  }

  await assertExistingDirectory(targetDir, "Sync target");
  const existingMarker = await readMarker(targetDir);
  if (!existingMarker) {
    assertCli(
      options.force,
      `Refusing to overwrite existing sync target without ${markerFileName}. Re-run with --force to take ownership. If using npm scripts, run: npm run sync -- --force`,
    );
    return;
  }

  assertCli(
    options.force || markerMatches(existingMarker, marker),
    `Refusing to overwrite sync target owned by another project. Re-run with --force to take ownership. If using npm scripts, run: npm run sync -- --force`,
  );
}

async function readMarker(targetDir: string): Promise<SyncMarker | undefined> {
  const markerPath = path.join(targetDir, markerFileName);
  try {
    const markerContent = await fs.readFile(markerPath, "utf8");
    const parsed = parseMarker(markerContent);
    if (
      parsed.tool === "mc-scaffolding" &&
      parsed.version === 1 &&
      typeof parsed.projectDir === "string" &&
      typeof parsed.packName === "string"
    ) {
      return parsed as SyncMarker;
    }
    return undefined;
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }
    throw error;
  }
}

function parseMarker(content: string): Partial<SyncMarker> {
  try {
    return JSON.parse(content) as Partial<SyncMarker>;
  } catch {
    return {};
  }
}

async function writeMarker(targetDir: string, marker: SyncMarker): Promise<void> {
  await fs.writeFile(path.join(targetDir, markerFileName), `${JSON.stringify(marker, null, 2)}\n`);
}

function createMarker(projectDir: string, packName: string): SyncMarker {
  return {
    tool: "mc-scaffolding",
    version: 1,
    projectDir: path.resolve(projectDir),
    packName,
  };
}

function markerMatches(left: SyncMarker, right: SyncMarker): boolean {
  return path.resolve(left.projectDir) === path.resolve(right.projectDir) && left.packName === right.packName;
}

function resolveSyncTarget(minecraftPath: string, packName: string): string {
  assertCli(isSingleDirectoryName(packName), "minecraft.packName must be a single directory name.");

  const targetDir = path.resolve(minecraftPath, packName);
  const relativeTarget = path.relative(minecraftPath, targetDir);

  assertCli(
    relativeTarget !== "" && !isOutsidePath(relativeTarget) && !path.isAbsolute(relativeTarget),
    "Resolved sync target must be inside the Minecraft development_behavior_packs directory.",
  );

  return targetDir;
}

function isSingleDirectoryName(value: string): boolean {
  return (
    value.trim().length > 0 &&
    value === value.trim() &&
    value !== "." &&
    value !== ".." &&
    !value.includes("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    !path.isAbsolute(value)
  );
}

function isOutsidePath(relativePath: string): boolean {
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`);
}

function assertDevelopmentBehaviorPacksPath(candidatePath: string): void {
  assertCli(
    path.basename(candidatePath).toLowerCase() === "development_behavior_packs",
    "Minecraft path must point to a development_behavior_packs directory.",
  );
}

async function assertExistingDirectory(candidatePath: string, label: string): Promise<void> {
  try {
    const stat = await fs.stat(candidatePath);
    assertCli(stat.isDirectory(), `${label} must be a directory.`);
  } catch (error) {
    if (isNotFoundError(error)) {
      assertCli(false, `${label} does not exist: ${candidatePath}`);
    }
    throw error;
  }
}

async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function isWindowsAccessError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EBUSY")
  );
}
