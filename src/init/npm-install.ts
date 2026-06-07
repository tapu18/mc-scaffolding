import { spawn } from "node:child_process";
import { CliError } from "../shared/errors.js";

export async function runNpmInstall(projectDir: string): Promise<void> {
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
