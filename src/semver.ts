export function isStableVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version);
}

export function compareSemver(a: string, b: string): number {
  const left = a.split(".").map((part) => Number.parseInt(part, 10));
  const right = b.split(".").map((part) => Number.parseInt(part, 10));

  for (let index = 0; index < 3; index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
}

export function sortSemverDesc(versions: string[]): string[] {
  return [...versions].sort((a, b) => compareSemver(b, a));
}
