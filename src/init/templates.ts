import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { behaviorSourceDir } from "../core/config.js";
import { CliError } from "../shared/errors.js";
import type { ScaffoldingConfig, ScriptApiModule } from "../shared/types.js";
import type { InitAnswers } from "./prompts.js";

export function createPackageJson(answers: InitAnswers, modules: ScriptApiModule[]): string {
  const dependencies = Object.fromEntries(modules.map((module) => [module.name, module.version]));
  const ownDependency = getOwnDependencySpecifier();
  const packageJson = {
    name: sanitizePackageName(answers.name),
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "mc-scaffolding dev",
      "dev:force": "mc-scaffolding dev --force",
      build: "mc-scaffolding build",
      "build:sync": "mc-scaffolding build --sync",
      "build:sync:force": "mc-scaffolding build --sync --force",
      sync: "mc-scaffolding sync",
      "sync:force": "mc-scaffolding sync --force",
      "sync:dry-run": "mc-scaffolding sync --dry-run",
    },
    dependencies,
    devDependencies: {
      "mc-scaffolding": ownDependency,
      typescript: "^5.9.3",
    },
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

export function createTsconfigJson(): string {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "Bundler",
        strict: true,
        noEmit: true,
        skipLibCheck: true,
      },
      include: ["src/**/*.ts"],
    },
    null,
    2,
  )}\n`;
}

export function createMainTs(): string {
  return `import { system, world } from "@minecraft/server";

system.run(() => {
  world.sendMessage("mc-scaffolding addon loaded");
});
`;
}

export function createConfigTs(config: ScaffoldingConfig): string {
  const minecraftPath = config.minecraft.path ? JSON.stringify(config.minecraft.path) : "undefined";

  return `export default {
  name: ${JSON.stringify(config.name)},
  description: ${JSON.stringify(config.description)},
  entry: ${JSON.stringify(config.entry)},
  minecraft: {
    edition: ${JSON.stringify(config.minecraft.edition)},
    packName: ${JSON.stringify(config.minecraft.packName)},
    path: ${minecraftPath},
  },
  build: {
    behaviorDir: ${JSON.stringify(config.build?.behaviorDir ?? behaviorSourceDir)},
    minify: ${JSON.stringify(config.build?.minify ?? false)},
    sourcemap: ${JSON.stringify(config.build?.sourcemap ?? false)},
  },
};
`;
}

export function createLaunchJson(moduleUuid: string): string {
  return `${JSON.stringify(
    {
      version: "0.3.0",
      configurations: [
        {
          type: "minecraft-js",
          request: "attach",
          name: "Debug with Minecraft",
          mode: "listen",
          preLaunchTask: "build",
          targetModuleUuid: moduleUuid,
          sourceMapRoot: "${workspaceFolder}/dist/debug/",
          generatedSourceRoot: "${workspaceFolder}/dist/scripts/",
          port: 19144,
        },
      ],
    },
    null,
    2,
  )}\n`;
}

export function createTasksJson(): string {
  return `${JSON.stringify(
    {
      version: "2.0.0",
      tasks: [
        {
          label: "build",
          type: "npm",
          script: "build",
          group: "build",
          problemMatcher: "$tsc",
        },
      ],
    },
    null,
    2,
  )}\n`;
}

export function createGitignore(): string {
  return `node_modules/
dist/
*.mcpack
*.mcaddon
`;
}

export function sanitizePackageName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getOwnDependencySpecifier(): string {
  const packageRoot = findPackageRoot(fileURLToPath(import.meta.url));
  if (!packageRoot) {
    throw new CliError("Could not locate mc-scaffolding package root.");
  }

  if (path.basename(path.dirname(packageRoot)) === "node_modules") {
    return `^${readPackageVersion(packageRoot)}`;
  }

  return `file:${packageRoot}`;
}

function findPackageRoot(startFile: string): string | undefined {
  let currentDir = path.dirname(startFile);

  while (currentDir !== path.dirname(currentDir)) {
    if (existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return undefined;
}

function readPackageVersion(packageRoot: string): string {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: unknown };
  if (typeof packageJson.version === "string" && packageJson.version.length > 0) {
    return packageJson.version;
  }

  throw new CliError("Could not read mc-scaffolding package version.");
}
