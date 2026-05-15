import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export function loadDotEnv(filePath = ".env") {
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadDotEnv();

export function envBoolean(name, fallback = false) {
  const value = process.env[name];

  if (value === undefined || value === "") return fallback;

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function envInteger(name, fallback) {
  const value = Number.parseInt(process.env[name] || "", 10);

  return Number.isFinite(value) ? value : fallback;
}

export function getTargetProfiles() {
  return (process.env.IG_TARGET_PROFILES || "")
    .split(",")
    .map((profile) => profile.trim().replace(/^@/, ""))
    .filter(Boolean);
}

export function getHumanDelayRange() {
  const min = envInteger("IG_MIN_DELAY_MS", 2200);
  const max = envInteger("IG_MAX_DELAY_MS", 6500);

  return {
    min: Math.min(min, max),
    max: Math.max(min, max)
  };
}

export async function humanDelay(label = "aguardando") {
  const { min, max } = getHumanDelayRange();
  const ms = Math.floor(min + Math.random() * (max - min + 1));

  console.log(`[delay] ${label}: ${ms}ms`);

  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function ensureParentDir(filePath) {
  await mkdir(dirname(filePath), { recursive: true });
}

export function nowIso() {
  return new Date().toISOString();
}
