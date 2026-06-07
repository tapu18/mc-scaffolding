export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliError";
  }
}

export function assertCli(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new CliError(message);
  }
}
