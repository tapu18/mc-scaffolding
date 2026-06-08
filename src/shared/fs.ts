import fs from "node:fs/promises";
import path from "node:path";
import { assertCli } from "./errors.js";

export async function pathExists(candidatePath: string): Promise<boolean> {
  try {
    await fs.access(candidatePath);
    return true;
  } catch {
    return false;
  }
}

export async function assertExistingDirectory(candidatePath: string, label: string): Promise<void> {
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

export function isInsidePath(parentPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath === "" || (!isOutsidePath(relativePath) && !path.isAbsolute(relativePath));
}

export function isOutsidePath(relativePath: string): boolean {
  return relativePath === ".." || relativePath.startsWith(`..${path.sep}`);
}

export function isNotFoundError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function isWindowsAccessError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === "EPERM" || error.code === "EBUSY")
  );
}

export function toPosixPath(candidatePath: string): string {
  return candidatePath.split(path.sep).join("/");
}
