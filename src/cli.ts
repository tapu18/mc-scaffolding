#!/usr/bin/env node
import { Command } from "commander";
import { registerBuildCommand } from "./commands/build.js";
import { registerDevCommand } from "./commands/dev.js";
import { registerInitCommand } from "./commands/init.js";
import { registerSyncCommand } from "./commands/sync.js";
import { registerUserConfigCommand } from "./commands/user-config.js";
import { CliError } from "./shared/errors.js";

const program = new Command();

program.name("mc-scaffolding").description("Minecraft Bedrock Script API addon scaffolding CLI.");

registerInitCommand(program);
registerBuildCommand(program);
registerSyncCommand(program);
registerDevCommand(program);
registerUserConfigCommand(program);

program.parseAsync(process.argv).catch((error: unknown) => {
  if (error instanceof CliError) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  if (error instanceof Error) {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
    return;
  }

  console.error(String(error));
  process.exitCode = 1;
});
