import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { createProgram } from "../dist/cli.js";
import { loadConfig } from "../dist/core/config.js";
import { runDev } from "../dist/core/dev.js";
import { createManifest } from "../dist/core/manifest.js";
import { createSyncPlan, syncPack } from "../dist/core/sync.js";
import { toManifestModuleVersion } from "../dist/minecraft/manifest-version.js";
import { resolveMinecraftPath } from "../dist/minecraft/paths.js";
import { formatVersionTuple, parseVersionTuple } from "../dist/minecraft/platform-version.js";
import { selectPreferredModuleVersion, selectServerVersionChoices } from "../dist/npm/module-selection.js";
import { sortSemverDesc } from "../dist/npm/semver.js";
import { getPackageVersion } from "../dist/shared/package-info.js";

const tempDirs = [];

after(async () => {
  await Promise.all(tempDirs.map((tempDir) => fs.rm(tempDir, { recursive: true, force: true })));
});

test("normalizes Minecraft package versions for manifest dependencies", () => {
  assert.equal(toManifestModuleVersion("2.1.0"), "2.1.0");
  assert.equal(toManifestModuleVersion("1.0.0-beta.1.21.80-stable"), "1.0.0-beta");
  assert.equal(toManifestModuleVersion("1.2.3-preview.4"), "1.2.3");
});

test("parses and formats version tuples", () => {
  assert.deepEqual(parseVersionTuple("1.20.80"), [1, 20, 80]);
  assert.deepEqual(parseVersionTuple(["1", "20", "80"]), [1, 20, 80]);
  assert.equal(formatVersionTuple([1, 20, 80]), "1.20.80");
  assert.throws(() => parseVersionTuple("1.20"), /Invalid version tuple/);
});

test("sorts stable semver versions descending", () => {
  assert.deepEqual(sortSemverDesc(["1.2.0", "1.10.0", "1.2.1"]), ["1.10.0", "1.2.1", "1.2.0"]);
});

test("prints package version from CLI", async () => {
  const packageJson = JSON.parse(await fs.readFile("package.json", "utf8"));
  const program = createProgram();
  const originalLog = console.log;
  let output = "";

  console.log = (value) => {
    output += String(value);
  };

  try {
    await program.parseAsync(["node", "mc-scaffolding", "version"]);
  } finally {
    console.log = originalLog;
  }

  assert.equal(getPackageVersion(), packageJson.version);
  assert.equal(output, packageJson.version);
});

test("exposes no-install init option", () => {
  const initCommand = createProgram().commands.find((command) => command.name() === "init");

  assert.ok(initCommand);
  assert.ok(initCommand.options.some((option) => option.long === "--no-install"));
});

test("selects Minecraft module versions without registry access", () => {
  const versions = ["1.0.0", "1.2.0", "1.0.0-beta.1.21.70-stable", "1.0.0-beta.1.21.80-stable"];

  assert.equal(
    selectPreferredModuleVersion("@minecraft/server", { versions }, { edition: "bedrock", allowBetaApis: true }),
    "1.0.0-beta.1.21.80-stable",
  );
  assert.equal(
    selectPreferredModuleVersion(
      "@minecraft/server",
      { versions, distTags: { beta: "2.0.0-beta.1.21.90-preview" } },
      { edition: "preview", allowBetaApis: true },
    ),
    "2.0.0-beta.1.21.90-preview",
  );
  assert.deepEqual(
    selectServerVersionChoices(versions, { edition: "bedrock", allowBetaApis: false }),
    ["1.2.0", "1.0.0"],
  );
});

test("reports npm registry timeout as a CLI error", async () => {
  process.env.MC_SCAFFOLDING_NPM_REGISTRY_TIMEOUT_MS = "10";
  const { getPackageVersions } = await import(`../dist/npm/registry.js?timeout-test=${Date.now()}`);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    const error = new Error("The operation was aborted due to timeout");
    error.name = "TimeoutError";
    throw error;
  };

  try {
    await assert.rejects(
      () => getPackageVersions("@minecraft/server"),
      /npm registry request timed out after 10ms/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.MC_SCAFFOLDING_NPM_REGISTRY_TIMEOUT_MS;
  }
});

test("loads and normalizes a valid config", async () => {
  const projectDir = await createProjectFixture();

  const config = await loadConfig(projectDir);

  assert.equal(config.description, "");
  assert.equal(config.entry, "src/main.ts");
  assert.equal(config.minecraft.packName, "test-pack");
  assert.equal(config.build?.behaviorDir, "behavior");
});

test("rejects invalid config values early", async () => {
  const projectDir = await createProjectFixture({
    minecraft: {
      edition: "java",
      packName: "test-pack",
      path: "../target",
    },
  });

  await assert.rejects(
    () => loadConfig(projectDir),
    /Config minecraft\.edition must be either bedrock or preview/,
  );
});

test("creates a Bedrock manifest from init-time manifest definition", () => {
  const manifest = createManifest(createManifestDefinition());

  assert.equal(manifest.format_version, 2);
  assert.equal(manifest.header.name, "test-pack");
  assert.equal(manifest.modules[0]?.entry, "scripts/main.js");
  assert.deepEqual(manifest.dependencies, [
    {
      module_name: "@minecraft/server",
      version: "2.0.0",
    },
  ]);
});

test("resolves an explicit Minecraft path", async () => {
  const targetDir = await createTempDir("mc-scaffolding-target-");
  const resolvedPath = await resolveMinecraftPath(createConfigObject({ minecraft: { path: targetDir } }));

  assert.equal(resolvedPath, path.resolve(targetDir));
});

test("syncs behavior and generated scripts to the target pack directory", async () => {
  const projectDir = await createProjectFixture();
  const targetRoot = await createMinecraftRoot("mc-scaffolding-sync-");
  const config = createConfigObject({ minecraft: { path: targetRoot } });
  await writeGeneratedOutput(projectDir, "console.log('sync check');");

  const result = await syncPack(projectDir, config);
  const targetDir = result.targetDir;

  assert.equal(targetDir, path.join(targetRoot, "test-pack"));
  assert.equal(await readText(path.join(targetDir, "manifest.json")), "{}");
  assert.match(await readText(path.join(targetDir, "scripts", "main.js")), /sync check/);
  assert.match(await readText(path.join(targetDir, ".mc-scaffolding.json")), /mc-scaffolding/);
  await assert.rejects(() => fs.access(path.join(targetDir, "debug")), /ENOENT/);
});

test("rejects unsafe sync target pack names", async () => {
  const projectDir = await createProjectFixture();
  const targetRoot = await createMinecraftRoot("mc-scaffolding-sync-");
  const config = createConfigObject({
    minecraft: {
      path: targetRoot,
      packName: "../outside",
    },
  });
  await writeGeneratedOutput(projectDir, "console.log('unsafe');");

  await assert.rejects(
    () => syncPack(projectDir, config),
    /minecraft\.packName must be a single directory name/,
  );
});

test("refuses to overwrite an unmanaged sync target unless forced", async () => {
  const projectDir = await createProjectFixture();
  const targetRoot = await createMinecraftRoot("mc-scaffolding-sync-");
  const targetDir = path.join(targetRoot, "test-pack");
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, "user-file.txt"), "do not delete");
  const config = createConfigObject({ minecraft: { path: targetRoot } });
  await writeGeneratedOutput(projectDir, "console.log('force sync');");

  await assert.rejects(
    () => syncPack(projectDir, config),
    /Refusing to overwrite existing sync target without \.mc-scaffolding\.json/,
  );

  const result = await syncPack(projectDir, config, { force: true });

  assert.equal(result.targetDir, targetDir);
  await assert.rejects(() => fs.access(path.join(targetDir, "user-file.txt")), /ENOENT/);
  assert.match(await readText(path.join(targetDir, "scripts", "main.js")), /force sync/);
});

test("dry-run reports sync actions without writing target files", async () => {
  const projectDir = await createProjectFixture();
  const targetRoot = await createMinecraftRoot("mc-scaffolding-sync-");
  const targetDir = path.join(targetRoot, "test-pack");
  const config = createConfigObject({ minecraft: { path: targetRoot } });
  await writeGeneratedOutput(projectDir, "console.log('dry run');");

  const result = await syncPack(projectDir, config, { dryRun: true });

  assert.equal(result.dryRun, true);
  assert.equal(result.targetDir, targetDir);
  assert.ok(result.actions.some((action) => action.includes("create")));
  await assert.rejects(() => fs.access(targetDir), /ENOENT/);
});

test("creates a sync plan without writing target files", async () => {
  const projectDir = await createProjectFixture();
  const targetRoot = await createMinecraftRoot("mc-scaffolding-sync-");
  const config = createConfigObject({ minecraft: { path: targetRoot } });
  await writeGeneratedOutput(projectDir, "console.log('plan');");

  const plan = await createSyncPlan(projectDir, config, { dryRun: true });

  assert.equal(plan.dryRun, true);
  assert.equal(plan.behaviorDir, path.join(projectDir, "behavior"));
  assert.equal(plan.distDir, path.join(projectDir, "dist"));
  assert.match(plan.marker.projectDir, /mc-scaffolding-project-/);
  await assert.rejects(() => fs.access(plan.targetDir), /ENOENT/);
});

test("requires an existing Minecraft development_behavior_packs path", async () => {
  const projectDir = await createProjectFixture();
  const missingTargetRoot = path.join(projectDir, "development_behavior_packs");
  const config = createConfigObject({ minecraft: { path: missingTargetRoot } });
  await writeGeneratedOutput(projectDir, "console.log('missing target');");

  await assert.rejects(
    () => syncPack(projectDir, config),
    /Minecraft development_behavior_packs path does not exist/,
  );
});

test("dev rebuilds and syncs when a source file changes", async () => {
  const projectDir = await createProjectFixture();
  const targetRoot = await createMinecraftRoot("mc-scaffolding-dev-");
  await writeProjectConfig(projectDir, createConfigObject({ minecraft: { path: targetRoot } }));
  await fs.writeFile(path.join(projectDir, "src", "main.ts"), "console.log('first');\n");

  const session = await runDev(projectDir);
  try {
    await fs.writeFile(path.join(projectDir, "src", "main.ts"), "console.log('second');\n");
    const syncedScriptPath = path.join(targetRoot, "test-pack", "scripts", "main.js");
    const syncedScript = await waitForFileText(syncedScriptPath, (text) => text.includes("second"));
    assert.match(syncedScript, /second/);
  } finally {
    await session.close();
  }
});

async function createProjectFixture(configOverrides = {}) {
  const projectDir = await createTempDir("mc-scaffolding-project-");
  await fs.mkdir(path.join(projectDir, "src"), { recursive: true });
  await fs.mkdir(path.join(projectDir, "behavior"), { recursive: true });
  await fs.writeFile(path.join(projectDir, "src", "main.ts"), "console.log('fixture');\n");
  await fs.writeFile(path.join(projectDir, "behavior", "manifest.json"), "{}");
  await writeProjectConfig(projectDir, createConfigObject(configOverrides));
  return projectDir;
}

async function createTempDir(prefix) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(tempDir);
  return tempDir;
}

async function createMinecraftRoot(prefix) {
  const parentDir = await createTempDir(prefix);
  const minecraftRoot = path.join(parentDir, "development_behavior_packs");
  await fs.mkdir(minecraftRoot, { recursive: true });
  return minecraftRoot;
}

async function writeProjectConfig(projectDir, config) {
  await fs.writeFile(
    path.join(projectDir, "scaffolding.config.ts"),
    `export default ${JSON.stringify(config, null, 2)};\n`,
  );
}

function createConfigObject(overrides = {}) {
  const minecraft = {
    edition: "bedrock",
    packName: "test-pack",
    path: path.join(os.tmpdir(), "mc-scaffolding-target"),
    ...(overrides.minecraft ?? {}),
  };
  return {
    name: "test-pack",
    entry: "src/main.ts",
    minecraft,
    build: {
      behaviorDir: "behavior",
      minify: false,
      sourcemap: false,
    },
    ...overrides,
    minecraft,
  };
}

function createManifestDefinition(overrides = {}) {
  return {
    name: "test-pack",
    description: "",
    uuid: "00000000-0000-4000-8000-000000000001",
    moduleUuid: "00000000-0000-4000-8000-000000000002",
    version: [1, 0, 0],
    minEngineVersion: [1, 20, 0],
    modules: [
      {
        name: "@minecraft/server",
        version: "2.0.0",
        manifestVersion: "2.0.0",
      },
    ],
    ...overrides,
  };
}

async function writeGeneratedOutput(projectDir, script) {
  await fs.mkdir(path.join(projectDir, "dist", "scripts"), { recursive: true });
  await fs.writeFile(path.join(projectDir, "dist", "scripts", "main.js"), script);
}

async function readText(filePath) {
  return fs.readFile(filePath, "utf8");
}

async function waitForFileText(filePath, predicate) {
  const deadline = Date.now() + 5000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const text = await readText(filePath);
      if (predicate(text)) {
        return text;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (lastError) {
    throw lastError;
  }
  throw new Error(`Timed out waiting for ${filePath}`);
}
