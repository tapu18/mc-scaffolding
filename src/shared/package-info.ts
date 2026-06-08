import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CliError } from "./errors.js";

interface PackageJson {
  version?: unknown;
}

export function getPackageRoot(startUrl: string = import.meta.url): string {
  const packageRoot = findPackageRoot(fileURLToPath(startUrl));
  if (!packageRoot) {
    throw new CliError("Could not locate mc-scaffolding package root.");
  }
  return packageRoot;
}

export function getPackageVersion(packageRoot = getPackageRoot()): string {
  const packageJson = readPackageJson(packageRoot);
  if (typeof packageJson.version === "string" && packageJson.version.length > 0) {
    return packageJson.version;
  }

  throw new CliError("Could not read mc-scaffolding package version.");
}

function findPackageRoot(startFile: string): string | undefined {
  let currentDir = path.dirname(startFile);

  while (currentDir !== path.dirname(currentDir)) {
    if (pathExistsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return undefined;
}

function readPackageJson(packageRoot: string): PackageJson {
  return JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")) as PackageJson;
}

function pathExistsSync(candidatePath: string): boolean {
  try {
    readFileSync(candidatePath);
    return true;
  } catch {
    return false;
  }
}
