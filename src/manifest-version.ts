export function toManifestModuleVersion(packageVersion: string): string {
  const match = packageVersion.match(/^(\d+\.\d+\.\d+)(?:-(beta)(?:[.-].*)?)?/);
  if (!match) {
    return packageVersion;
  }

  const baseVersion = match[1]!;
  const betaSuffix = match[2] ? "-beta" : "";
  return `${baseVersion}${betaSuffix}`;
}
