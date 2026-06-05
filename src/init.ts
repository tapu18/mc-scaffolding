import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { checkbox, input, select } from "@inquirer/prompts";
import { configFileName } from "./config.js";
import { CliError, assertCli } from "./errors.js";
import { detectMinecraftPaths } from "./minecraft-paths.js";
import {
  getLatestStableVersion,
  getMinecraftModuleChoices,
  getServerVersionChoices,
} from "./npm-registry.js";
import type { MinecraftEdition, MinecraftPathCandidate, ScriptApiModule } from "./types.js";

interface InitAnswers {
  name: string;
  description: string;
  edition: MinecraftEdition;
  minecraftPath?: string;
  serverVersion: string;
  additionalModules: string[];
  minEngineVersion: [number, number, number] | "omit";
}

const generatedFiles = [
  "package.json",
  "tsconfig.json",
  path.join("src", "main.ts"),
  configFileName,
  ".gitignore",
];

export async function initProject(projectDir: string): Promise<void> {
  await assertNoGeneratedFileCollisions(projectDir);

  const answers = await promptForInit(projectDir);
  const modules = await resolveModules(answers);

  await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(projectDir, "package.json"), createPackageJson(answers, modules)),
    fs.writeFile(path.join(projectDir, "tsconfig.json"), createTsconfigJson()),
    fs.writeFile(path.join(projectDir, "src", "main.ts"), createMainTs()),
    fs.writeFile(path.join(projectDir, configFileName), createConfigTs(answers, modules)),
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

  const pathCandidates = await detectMinecraftPaths();
  const existingCandidates = pathCandidates.filter((candidate) => candidate.exists);
  const edition = await promptEdition(existingCandidates);
  const minecraftPath = await promptMinecraftPath(existingCandidates, edition);
  const serverVersion = await promptServerVersion();
  const additionalModules = await promptAdditionalModules();
  const minEngineVersion = parseMinEngineVersion(
    await input({
      message: "min_engine_version (empty to omit)",
      default: "",
    }),
  );

  return {
    name,
    description,
    edition,
    minecraftPath,
    serverVersion,
    additionalModules,
    minEngineVersion,
  };
}

async function promptEdition(candidates: MinecraftPathCandidate[]): Promise<MinecraftEdition> {
  const editions = new Set(candidates.map((candidate) => candidate.edition));
  if (editions.size === 1) {
    return [...editions][0]!;
  }

  return select<MinecraftEdition>({
    message: "Minecraft edition",
    choices: [
      { name: "Minecraft Bedrock", value: "bedrock" },
      { name: "Minecraft Preview", value: "preview" },
    ],
    default: "bedrock",
  });
}

async function promptMinecraftPath(
  candidates: MinecraftPathCandidate[],
  edition: MinecraftEdition,
): Promise<string | undefined> {
  const matchingCandidates = candidates.filter((candidate) => candidate.edition === edition);
  if (matchingCandidates.length === 1) {
    return matchingCandidates[0]!.path;
  }

  if (matchingCandidates.length > 1) {
    return select<string>({
      message: "development_behavior_packs path",
      choices: matchingCandidates.map((candidate) => ({
        name: `${candidate.label}: ${candidate.path}`,
        value: candidate.path,
      })),
    });
  }

  return input({
    message: "development_behavior_packs path",
    required: true,
  });
}

async function promptServerVersion(): Promise<string> {
  const choices = await getServerVersionChoices();
  assertCli(choices.length > 0, "Could not resolve @minecraft/server versions from npm.");

  return select<string>({
    message: "@minecraft/server version",
    choices: choices.map((version, index) => ({
      name: index === 0 ? `${version} (latest stable)` : version,
      value: version,
    })),
    default: choices[0],
  });
}

async function promptAdditionalModules(): Promise<string[]> {
  let modules: string[] = [];
  try {
    modules = await getMinecraftModuleChoices();
  } catch {
    modules = [];
  }

  if (modules.length === 0) {
    return [];
  }

  return checkbox<string>({
    message: "Additional Script API modules",
    choices: modules.map((moduleName) => ({
      name: moduleName,
      value: moduleName,
    })),
  });
}

async function resolveModules(answers: InitAnswers): Promise<ScriptApiModule[]> {
  const modules: ScriptApiModule[] = [
    {
      name: "@minecraft/server",
      version: answers.serverVersion,
    },
  ];

  for (const moduleName of answers.additionalModules) {
    modules.push({
      name: moduleName,
      version: await getLatestStableVersion(moduleName),
    });
  }

  return modules;
}

function createPackageJson(answers: InitAnswers, modules: ScriptApiModule[]): string {
  const dependencies = Object.fromEntries(modules.map((module) => [module.name, module.version]));
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
      "mc-scaffolding": "^0.1.0",
      typescript: "^5.9.3",
    },
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
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

function createConfigTs(answers: InitAnswers, modules: ScriptApiModule[]): string {
  const minEngineVersion =
    answers.minEngineVersion === "omit"
      ? `"omit"`
      : `[${answers.minEngineVersion.join(", ")}]`;
  const minecraftPath = answers.minecraftPath ? JSON.stringify(answers.minecraftPath) : "undefined";

  return `export default {
  name: ${JSON.stringify(answers.name)},
  description: ${JSON.stringify(answers.description)},
  entry: "src/main.ts",
  scriptApi: {
    modules: ${JSON.stringify(modules, null, 6).replace(/^/gm, "    ").trim()},
  },
  manifest: {
    uuid: ${JSON.stringify(crypto.randomUUID())},
    moduleUuid: ${JSON.stringify(crypto.randomUUID())},
    version: [1, 0, 0],
    minEngineVersion: ${minEngineVersion},
  },
  minecraft: {
    edition: ${JSON.stringify(answers.edition)},
    packName: ${JSON.stringify(answers.name)},
    path: ${minecraftPath},
  },
  build: {
    minify: false,
    sourcemap: false,
  },
};
`;
}

function createGitignore(): string {
  return `node_modules/
dist/
*.mcpack
*.mcaddon
`;
}

function parseMinEngineVersion(value: string): [number, number, number] | "omit" {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "omit";
  }

  const parts = trimmed.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    throw new CliError("min_engine_version must be empty or use x.y.z format.");
  }

  return [parts[0]!, parts[1]!, parts[2]!];
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
