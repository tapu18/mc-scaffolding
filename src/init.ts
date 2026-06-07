import { spawn } from "node:child_process";
import crypto from "node:crypto";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { behaviorSourceDir, configFileName } from "./config.js";
import { CliError, assertCli } from "./errors.js";
import { writeManifest } from "./manifest.js";
import { getDefaultMinecraftPathCandidates } from "./minecraft-paths.js";
import {
  getMinecraftModuleChoices,
  toManifestModuleVersion,
  getServerVersionChoices,
  type ModuleVersionPolicy,
} from "./npm-registry.js";
import {
  formatVersionTuple,
  parseVersionTuple,
  resolveRecommendedMinEngineVersion,
  type VersionTuple,
} from "./platform-version.js";
import { loadUserConfig } from "./user-config.js";
import type {
  MinecraftEdition,
  MinecraftPathCandidate,
  ScaffoldingConfig,
  ScriptApiModule,
} from "./types.js";

interface InitAnswers {
  name: string;
  description: string;
  edition: MinecraftEdition;
  minecraftPath?: string;
  allowBetaApis: boolean;
  serverVersion: string;
  additionalModules: ScriptApiModule[];
  minEngineVersion: VersionTuple;
}

const generatedFiles = [
  "package.json",
  "tsconfig.json",
  path.join("src", "main.ts"),
  behaviorSourceDir,
  path.join(".vscode", "launch.json"),
  path.join(".vscode", "tasks.json"),
  configFileName,
  ".gitignore",
];

export async function initProject(projectDir: string): Promise<void> {
  await assertNoGeneratedFileCollisions(projectDir);

  const answers = await promptForInit(projectDir);
  const modules = await resolveModules(answers);
  const projectConfig = createProjectConfig(answers, modules);

  await Promise.all([
    fs.mkdir(path.join(projectDir, "src"), { recursive: true }),
    fs.mkdir(path.join(projectDir, behaviorSourceDir), { recursive: true }),
    fs.mkdir(path.join(projectDir, ".vscode"), { recursive: true }),
  ]);
  await Promise.all([
    fs.writeFile(path.join(projectDir, "package.json"), createPackageJson(answers, modules)),
    fs.writeFile(path.join(projectDir, "tsconfig.json"), createTsconfigJson()),
    fs.writeFile(path.join(projectDir, "src", "main.ts"), createMainTs()),
    fs.writeFile(path.join(projectDir, configFileName), createConfigTs(projectConfig)),
    fs.writeFile(path.join(projectDir, ".vscode", "launch.json"), createLaunchJson(projectConfig)),
    fs.writeFile(path.join(projectDir, ".vscode", "tasks.json"), createTasksJson()),
    writeManifest(path.join(projectDir, behaviorSourceDir, "manifest.json"), projectConfig),
    fs.writeFile(path.join(projectDir, ".gitignore"), createGitignore()),
  ]);

  await runNpmInstall(projectDir);
}

async function assertNoGeneratedFileCollisions(projectDir: string): Promise<void> {
  const collisions: string[] = [];
  for (const relativePath of generatedFiles) {
    try {
      await fs.access(path.join(projectDir, relativePath));
      collisions.push(relativePath);
    } catch {
      // Missing files are expected.
    }
  }

  assertCli(
    collisions.length === 0,
    `Refusing to overwrite existing files: ${collisions.join(", ")}`,
  );
}

async function promptForInit(projectDir: string): Promise<InitAnswers> {
  const defaultName = sanitizePackageName(path.basename(projectDir)) || "my-addon";
  const name = await input({
    message: "Pack name",
    default: defaultName,
    required: true,
  });

  const description = await input({
    message: "Description",
    default: "My Bedrock Script API addon",
  });

  const pathCandidates = await getInitMinecraftPathCandidates();
  const edition = await promptEdition(pathCandidates);
  const minecraftPath = await promptMinecraftPath(pathCandidates, edition);
  const allowBetaApis = await promptAllowBetaApis();
  const moduleVersionPolicy = { edition, allowBetaApis };
  const serverVersion = await promptServerVersion(moduleVersionPolicy);
  const additionalModules = await promptAdditionalModules(moduleVersionPolicy);
  const minEngineVersion = await promptMinEngineVersion();

  return {
    name,
    description,
    edition,
    minecraftPath,
    allowBetaApis,
    serverVersion,
    additionalModules,
    minEngineVersion,
  };
}

async function getInitMinecraftPathCandidates(): Promise<MinecraftPathCandidate[]> {
  const userConfig = await loadUserConfig();
  const userCandidates = Object.entries(userConfig.minecraft ?? {}).map(([edition, configuredPath]) => ({
    edition: edition as MinecraftEdition,
    label: `Configured ${edition}`,
    path: configuredPath,
    exists: true,
  }));
  return dedupePathCandidates([...userCandidates, ...getDefaultMinecraftPathCandidates()]);
}

function dedupePathCandidates(candidates: MinecraftPathCandidate[]): MinecraftPathCandidate[] {
  const seen = new Set<string>();
  const uniqueCandidates: MinecraftPathCandidate[] = [];

  for (const candidate of candidates) {
    const key = `${candidate.edition}:${path.resolve(candidate.path)}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueCandidates.push(candidate);
  }

  return uniqueCandidates;
}

async function promptAllowBetaApis(): Promise<boolean> {
  return confirm({
    message: "Allow beta Script API modules?",
    default: false,
  });
}

async function promptMinEngineVersion(): Promise<VersionTuple> {
  const recommended = await resolveRecommendedMinEngineVersion();
  return parseMinEngineVersion(
    await input({
      message: "min_engine_version",
      default: formatVersionTuple(recommended),
      required: true,
    }),
  );
}

async function promptEdition(candidates: MinecraftPathCandidate[]): Promise<MinecraftEdition> {
  const defaultEdition = candidates.find((candidate) => candidate.exists)?.edition ?? "bedrock";

  return select<MinecraftEdition>({
    message: "Minecraft edition",
    choices: [
      { name: "Minecraft Bedrock", value: "bedrock" },
      { name: "Minecraft Preview", value: "preview" },
    ],
    default: defaultEdition,
  });
}

async function promptMinecraftPath(
  candidates: MinecraftPathCandidate[],
  edition: MinecraftEdition,
): Promise<string | undefined> {
  const matchingCandidates = candidates.filter((candidate) => candidate.edition === edition);
  if (matchingCandidates.length === 1) {
    return input({
      message: "development_behavior_packs path",
      default: matchingCandidates[0]!.path,
      required: true,
    });
  }

  if (matchingCandidates.length > 1) {
    return select<string>({
      message: "development_behavior_packs path",
      choices: matchingCandidates.map((candidate) => ({
        name: `${candidate.label}: ${candidate.path}`,
        value: candidate.path,
      })),
      default: matchingCandidates[0]!.path,
    });
  }

  return input({
    message: "development_behavior_packs path",
    required: true,
  });
}

async function promptServerVersion(policy: ModuleVersionPolicy): Promise<string> {
  const choices = await getServerVersionChoices(policy);
  assertCli(choices.length > 0, "Could not resolve @minecraft/server versions from npm.");

  return select<string>({
    message: "@minecraft/server version",
    choices: choices.map((version, index) => ({
      name: index === 0 ? `${version} (recommended)` : version,
      value: version,
    })),
    default: choices[0],
  });
}

async function promptAdditionalModules(policy: ModuleVersionPolicy): Promise<ScriptApiModule[]> {
  let modules: ScriptApiModule[] = [];
  try {
    modules = await getMinecraftModuleChoices(policy);
  } catch {
    modules = [];
  }

  if (modules.length === 0) {
    return [];
  }

  return checkbox<string>({
    message: "Additional Script API modules",
    choices: modules.map((module) => ({
      name: formatAdditionalModuleChoice(module),
      value: module.name,
    })),
  }).then((selectedNames) =>
    modules.filter((module) => selectedNames.includes(module.name)),
  );
}

function formatAdditionalModuleChoice(module: ScriptApiModule): string {
  const moduleName = module.name;
  const suffix = `npm ${module.version}, manifest ${module.manifestVersion}`;
  if (moduleName === "@minecraft/server-ui") {
    return `${moduleName} - forms and UI (${suffix})`;
  }
  if (moduleName === "@minecraft/server-gametest") {
    return `${moduleName} - GameTest APIs (${suffix})`;
  }
  return `${moduleName} (${suffix})`;
}

async function resolveModules(answers: InitAnswers): Promise<ScriptApiModule[]> {
  const modules: ScriptApiModule[] = [
    {
      name: "@minecraft/server",
      version: answers.serverVersion,
      manifestVersion: toManifestModuleVersion(answers.serverVersion),
    },
  ];

  modules.push(...answers.additionalModules);

  return modules;
}

function createPackageJson(answers: InitAnswers, modules: ScriptApiModule[]): string {
  const dependencies = Object.fromEntries(modules.map((module) => [module.name, module.version]));
  const ownDependency = getOwnDependencySpecifier();
  const packageJson = {
    name: sanitizePackageName(answers.name),
    version: "0.1.0",
    private: true,
    type: "module",
    scripts: {
      dev: "mc-scaffolding dev",
      build: "mc-scaffolding build",
      sync: "mc-scaffolding sync",
    },
    dependencies,
    devDependencies: {
      "mc-scaffolding": ownDependency,
      typescript: "^5.9.3",
    },
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

function getOwnDependencySpecifier(): string {
  const packageRoot = findPackageRoot(fileURLToPath(import.meta.url));
  if (!packageRoot) {
    return "^0.1.0";
  }

  if (path.basename(path.dirname(packageRoot)) === "node_modules") {
    return "^0.1.0";
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

function createTsconfigJson(): string {
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

function createMainTs(): string {
  return `import { system, world } from "@minecraft/server";

system.run(() => {
  world.sendMessage("mc-scaffolding addon loaded");
});
`;
}

function createConfigTs(config: ScaffoldingConfig): string {
  const minEngineVersion = `[${config.manifest.minEngineVersion.join(", ")}]`;
  const minecraftPath = config.minecraft.path ? JSON.stringify(config.minecraft.path) : "undefined";

  return `export default {
  name: ${JSON.stringify(config.name)},
  description: ${JSON.stringify(config.description)},
  entry: ${JSON.stringify(config.entry)},
  scriptApi: {
    modules: ${JSON.stringify(config.scriptApi.modules, null, 6).replace(/^/gm, "    ").trim()},
  },
  manifest: {
    uuid: ${JSON.stringify(config.manifest.uuid)},
    moduleUuid: ${JSON.stringify(config.manifest.moduleUuid)},
    version: [${config.manifest.version?.join(", ") ?? "1, 0, 0"}],
    minEngineVersion: ${minEngineVersion},
  },
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

function createLaunchJson(config: ScaffoldingConfig): string {
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
          targetModuleUuid: config.manifest.moduleUuid,
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

function createTasksJson(): string {
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

function createProjectConfig(answers: InitAnswers, modules: ScriptApiModule[]): ScaffoldingConfig {
  return {
    name: answers.name,
    description: answers.description,
    entry: "src/main.ts",
    scriptApi: {
      modules,
    },
    manifest: {
      uuid: crypto.randomUUID(),
      moduleUuid: crypto.randomUUID(),
      version: [1, 0, 0] as [number, number, number],
      minEngineVersion: answers.minEngineVersion,
    },
    minecraft: {
      edition: answers.edition,
      packName: answers.name,
      path: answers.minecraftPath,
    },
    build: {
      behaviorDir: behaviorSourceDir,
      minify: false,
      sourcemap: true,
    },
  };
}

function createGitignore(): string {
  return `node_modules/
dist/
*.mcpack
*.mcaddon
`;
}

function parseMinEngineVersion(value: string): VersionTuple {
  const trimmed = value.trim();
  try {
    return parseVersionTuple(trimmed);
  } catch {
    throw new CliError("min_engine_version must use x.y.z format.");
  }
}

function sanitizePackageName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function runNpmInstall(projectDir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("npm", ["install"], {
      cwd: projectDir,
      stdio: "inherit",
      shell: process.platform === "win32",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new CliError(`npm install failed with exit code ${code ?? "unknown"}.`));
    });
  });
}
