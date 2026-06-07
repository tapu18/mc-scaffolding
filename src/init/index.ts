import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { behaviorSourceDir, configFileName } from "../core/config.js";
import { writeManifest, type ManifestDefinition } from "../core/manifest.js";
import { toManifestModuleVersion } from "../minecraft/manifest-version.js";
import { assertCli } from "../shared/errors.js";
import type { ScaffoldingConfig, ScriptApiModule } from "../shared/types.js";
import { runNpmInstall } from "./npm-install.js";
import { promptForInit, type InitAnswers } from "./prompts.js";
import {
  createConfigTs,
  createGitignore,
  createLaunchJson,
  createMainTs,
  createPackageJson,
  createTasksJson,
  createTsconfigJson,
} from "./templates.js";

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
  const manifestDefinition = createManifestDefinition(answers, modules);
  const projectConfig = createProjectConfig(answers);

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
    fs.writeFile(path.join(projectDir, ".vscode", "launch.json"), createLaunchJson(manifestDefinition.moduleUuid)),
    fs.writeFile(path.join(projectDir, ".vscode", "tasks.json"), createTasksJson()),
    writeManifest(path.join(projectDir, behaviorSourceDir, "manifest.json"), manifestDefinition),
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

function createManifestDefinition(answers: InitAnswers, modules: ScriptApiModule[]): ManifestDefinition {
  return {
    name: answers.name,
    description: answers.description,
    uuid: crypto.randomUUID(),
    moduleUuid: crypto.randomUUID(),
    version: [1, 0, 0],
    minEngineVersion: answers.minEngineVersion,
    modules,
  };
}

function createProjectConfig(answers: InitAnswers): ScaffoldingConfig {
  return {
    name: answers.name,
    description: answers.description,
    entry: "src/main.ts",
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
