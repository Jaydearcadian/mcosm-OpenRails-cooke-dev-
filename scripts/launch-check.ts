import * as fs from "fs";
import * as path from "path";

import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

type Status = "pass" | "warn" | "fail";

interface CheckResult {
  status: Status;
  area: string;
  item: string;
  detail: string;
}

interface PackageJson {
  scripts?: Record<string, string>;
}

const repoRoot = path.resolve(__dirname, "..");
const results: CheckResult[] = [];

const requiredScripts = [
  "compile",
  "build:sdk",
  "test",
  "test:foundry",
  "deploy:openrails",
  "smoke:testnet",
  "dev",
  "start",
];

const requiredFiles = [
  "contracts/ArcOpenRailsHubV1.sol",
  "contracts/MockUSDC.sol",
  "scripts/deploy-openrails.ts",
  "scripts/smoke-openrails-testnet.ts",
  "dashboard/index.html",
  "dashboard/app.js",
  "dashboard/style.css",
  "sdk/src/links.ts",
  "sdk/src/access.ts",
  ".env.example",
  "deployments/openrails-addresses.example.json",
];

const requiredEnv = [
  "ARC_RPC_URL",
  "ARC_CHAIN_ID",
  "DEPLOYER_PRIVATE_KEY",
  "ARC_USDC_ADDRESS",
  "ARC_OPENRAILS_HUB_ADDRESS",
  "OPENRAILS_PAYER_PRIVATE_KEY",
  "OPENRAILS_RELAYER_PRIVATE_KEY",
  "OPENRAILS_RECIPIENT_ADDRESS",
  "OPENRAILS_CLAIM_RECIPIENT_ADDRESS",
  "OPENRAILS_RECOVERY_ADDRESS",
];

const addressEnv = [
  "ARC_USDC_ADDRESS",
  "ARC_OPENRAILS_HUB_ADDRESS",
  "OPENRAILS_RECIPIENT_ADDRESS",
  "OPENRAILS_CLAIM_RECIPIENT_ADDRESS",
  "OPENRAILS_RECOVERY_ADDRESS",
];

const privateKeyEnv = [
  "DEPLOYER_PRIVATE_KEY",
  "OPENRAILS_PAYER_PRIVATE_KEY",
  "OPENRAILS_RELAYER_PRIVATE_KEY",
];

const manualSignoffs = [
  "Independent contract/security review accepted",
  "Owner and deployer key custody confirmed",
  "No production funds in demo wallets",
  "Circle Paymaster enablement explicitly approved",
  "Contract verification and ABI publication complete",
  "Emergency pause and rollback owner available",
];

const dashboardMode = process.env.OPENRAILS_DASHBOARD_MODE || "local";
const publicRelayerEnabled =
  dashboardMode === "arc-testnet" && process.env.OPENRAILS_ENABLE_ARC_PUBLIC_RELAYER === "true";

function add(status: Status, area: string, item: string, detail: string) {
  results.push({ status, area, item, detail });
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function isPlaceholder(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "" ||
    normalized === "0" ||
    normalized === "0x0000000000000000000000000000000000000000" ||
    normalized.includes("replace-with") ||
    normalized.includes("example.invalid") ||
    normalized.includes("<") ||
    normalized.includes(">")
  );
}

function checkScripts() {
  const packagePath = path.join(repoRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8")) as PackageJson;
  const scripts = packageJson.scripts || {};

  for (const scriptName of requiredScripts) {
    if (scripts[scriptName]) {
      add("pass", "repo", `npm run ${scriptName}`, "script is present");
    } else {
      add("fail", "repo", `npm run ${scriptName}`, "required launch script is missing");
    }
  }
}

function checkFiles() {
  for (const filePath of requiredFiles) {
    if (exists(filePath)) {
      add("pass", "repo", filePath, "required file is present");
    } else {
      add("fail", "repo", filePath, "required launch file is missing");
    }
  }
}

function checkEnv() {
  if (dashboardMode !== "local" && dashboardMode !== "arc-testnet") {
    add("fail", "env", "OPENRAILS_DASHBOARD_MODE", "must be local or arc-testnet");
  } else {
    add("pass", "env", "OPENRAILS_DASHBOARD_MODE", `dashboard mode is ${dashboardMode}`);
  }

  for (const envName of requiredEnv) {
    if (
      dashboardMode === "arc-testnet" &&
      ["DEPLOYER_PRIVATE_KEY", "OPENRAILS_PAYER_PRIVATE_KEY"].includes(envName)
    ) {
      add("warn", "env", envName, "not required for Arc testnet dashboard mode");
      continue;
    }
    if (dashboardMode === "arc-testnet" && envName === "OPENRAILS_RELAYER_PRIVATE_KEY" && !publicRelayerEnabled) {
      add("warn", "env", envName, "not required unless OPENRAILS_ENABLE_ARC_PUBLIC_RELAYER=true");
      continue;
    }
    const value = process.env[envName];
    if (!value) {
      if (envName === "OPENRAILS_RELAYER_PRIVATE_KEY" && publicRelayerEnabled) {
        add("fail", "env", envName, "required when OPENRAILS_ENABLE_ARC_PUBLIC_RELAYER=true");
        continue;
      }
      add("warn", "env", envName, "not set in environment or .env");
      continue;
    }

    if (isPlaceholder(value)) {
      add("warn", "env", envName, "set to a placeholder value");
      continue;
    }

    if (addressEnv.includes(envName) && !ethers.isAddress(value)) {
      add("fail", "env", envName, "set but not a valid EVM address");
      continue;
    }

    if (envName === "ARC_CHAIN_ID" && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
      add("fail", "env", envName, "set but not a positive integer chain ID");
      continue;
    }

    if (envName === "ARC_RPC_URL" && !/^https?:\/\//u.test(value)) {
      add("fail", "env", envName, "set but not an HTTP(S) URL");
      continue;
    }

    if (privateKeyEnv.includes(envName) && !/^(0x)?[0-9a-fA-F]{64}$/u.test(value)) {
      add("fail", "env", envName, "set but not a 32-byte hex private key");
      continue;
    }

    add("pass", "env", envName, "configured with a non-placeholder value");
  }

  if (publicRelayerEnabled) {
    add("pass", "env", "OPENRAILS_ENABLE_ARC_PUBLIC_RELAYER", "public Arc relayer alpha is enabled");
    for (const [envName, fallback] of [
      ["OPENRAILS_PUBLIC_RELAYER_MAX_ALLOCATION_USDC", "1"],
      ["OPENRAILS_PUBLIC_RELAYER_MAX_LIFESPAN_SECONDS", "3600"],
      ["OPENRAILS_PUBLIC_RELAYER_MAX_VELOCITY_USDC_PER_SECOND", "0.1"],
    ] as const) {
      const value = process.env[envName] || fallback;
      const validNumber = envName === "OPENRAILS_PUBLIC_RELAYER_MAX_LIFESPAN_SECONDS"
        ? /^\d+$/u.test(value)
        : /^\d+(\.\d+)?$/u.test(value);
      if (!validNumber || Number(value) <= 0) {
        add("fail", "env", envName, "must be a positive numeric public relayer cap");
      } else {
        add("pass", "env", envName, `public relayer cap is ${value}`);
      }
    }
  }
}

function checkRegistry() {
  const registryPath = process.env.OPENRAILS_DEPLOYMENT_REGISTRY_PATH;
  if (!registryPath || isPlaceholder(registryPath)) {
    add("warn", "registry", "OPENRAILS_DEPLOYMENT_REGISTRY_PATH", "not configured");
    return;
  }

  const resolvedPath = path.resolve(repoRoot, registryPath);
  if (!fs.existsSync(resolvedPath)) {
    add("warn", "registry", registryPath, "registry file does not exist yet");
    return;
  }

  let registry: Record<string, unknown>;
  try {
    registry = JSON.parse(fs.readFileSync(resolvedPath, "utf8")) as Record<string, unknown>;
  } catch {
    add("fail", "registry", registryPath, "registry file is not valid JSON");
    return;
  }
  const chainId = Number(registry.chainId);
  const hub = String(registry.arcOpenRailsHubV1 || "");
  const usdc = String(registry.arcUsdcAddress || "");
  const explorer = String(registry.explorerBaseUrl || "");

  if (Number.isInteger(chainId) && chainId > 0) {
    add("pass", "registry", "chainId", "registry has a non-placeholder chain ID");
  } else {
    add("fail", "registry", "chainId", "registry chain ID is missing or invalid");
  }

  if (ethers.isAddress(hub) && !isPlaceholder(hub)) {
    add("pass", "registry", "arcOpenRailsHubV1", "registry has a valid hub address");
  } else {
    add("fail", "registry", "arcOpenRailsHubV1", "registry hub address is missing or placeholder");
  }

  if (ethers.isAddress(usdc) && !isPlaceholder(usdc)) {
    add("pass", "registry", "arcUsdcAddress", "registry has a valid token address");
  } else {
    add("fail", "registry", "arcUsdcAddress", "registry token address is missing or placeholder");
  }

  if (explorer && !isPlaceholder(explorer)) {
    add("pass", "registry", "explorerBaseUrl", "registry has an explorer base URL");
  } else {
    add("warn", "registry", "explorerBaseUrl", "explorer base URL is missing or placeholder");
  }
}

function checkManualSignoffs() {
  for (const item of manualSignoffs) {
    add("warn", "manual", item, "human signoff required before public launch");
  }
}

function printResults() {
  const order: Status[] = ["fail", "warn", "pass"];
  for (const status of order) {
    const matching = results.filter((result) => result.status === status);
    if (matching.length === 0) continue;
    console.log(`\n${status.toUpperCase()} (${matching.length})`);
    for (const result of matching) {
      console.log(`[${result.area}] ${result.item}: ${result.detail}`);
    }
  }

  const failCount = results.filter((result) => result.status === "fail").length;
  const warnCount = results.filter((result) => result.status === "warn").length;
  const passCount = results.filter((result) => result.status === "pass").length;
  console.log(`\nSummary: ${passCount} pass, ${warnCount} warn, ${failCount} fail`);

  if (failCount > 0) {
    process.exitCode = 1;
  }
}

checkScripts();
checkFiles();
checkEnv();
checkRegistry();
checkManualSignoffs();
printResults();
