import fs from "node:fs/promises";
import path from "node:path";
import { behaviorSourceDir, internalOutDir } from "./config.js";
import { assertCli } from "../shared/errors.js";
import { isOutsidePath, pathExists } from "../shared/fs.js";

export function resolveBehaviorDir(projectDir: string, behaviorDir: string): string {
  assertCli(behaviorDir.trim().length > 0, "build.behaviorDir must not be empty.");
  assertCli(!path.isAbsolute(behaviorDir), "build.behaviorDir must be relative to the project directory.");

  const resolvedProjectDir = path.resolve(projectDir);
  const resolvedBehaviorDir = path.resolve(resolvedProjectDir, behaviorDir);
  const relativeBehaviorDir = path.relative(resolvedProjectDir, resolvedBehaviorDir);

  assertCli(
    relativeBehaviorDir !== "" &&
      !isOutsidePath(relativeBehaviorDir) &&
      !path.isAbsolute(relativeBehaviorDir),
    "build.behaviorDir must resolve inside the project directory.",
  );

  const relativeOutDir = path.relative(path.resolve(resolvedProjectDir, internalOutDir), resolvedBehaviorDir);
  assertCli(
    isOutsidePath(relativeOutDir) || path.isAbsolute(relativeOutDir),
    "build.behaviorDir must not be inside dist.",
  );

  return resolvedBehaviorDir;
}

export async function resolveExistingBehaviorDir(projectDir: string, behaviorDir = behaviorSourceDir): Promise<string> {
  const resolvedBehaviorDir = resolveBehaviorDir(projectDir, behaviorDir);
  await assertBehaviorDir(resolvedBehaviorDir);
  return resolvedBehaviorDir;
}

async function assertBehaviorDir(behaviorDir: string): Promise<void> {
  assertCli(await pathExists(behaviorDir), "build.behaviorDir does not exist.");
  const behaviorStat = await fs.stat(behaviorDir);
  assertCli(behaviorStat.isDirectory(), "build.behaviorDir must point to a directory.");
}

