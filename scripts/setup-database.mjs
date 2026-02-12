import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnvFile() {
  const path = join(root, ".env");
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = match[2].trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function runPnpm(args) {
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
  const result = spawnSync(pnpmCmd, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function main() {
  loadEnvFile();

  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Configure it in .env first.");
    process.exit(1);
  }

  console.log("Running Prisma migrations...");
  runPnpm(["prisma", "migrate", "deploy"]);

  console.log("Generating Prisma Client...");
  runPnpm(["prisma", "generate"]);

  console.log("Database setup complete.");
}

main();
