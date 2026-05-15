import { chromium } from "playwright";
import { existsSync } from "node:fs";
import { envBoolean, envInteger, getTargetProfiles, humanDelay, nowIso } from "./utils.js";
import { parseReelPage } from "./parser.js";
import { saveJson, saveToSupabase } from "./save-json.js";

const storageState = process.env.IG_STORAGE_STATE || "playwright/.auth/instagram.json";
const maxReels = envInteger("IG_MAX_REELS_PER_PROFILE", 5);
const targetProfiles = getTargetProfiles();

if (!targetProfiles.length) {
  console.error("Defina IG_TARGET_PROFILES no .env. Exemplo: IG_TARGET_PROFILES=perfil1,perfil2");
  process.exit(1);
}

if (!existsSync(storageState)) {
  console.error(`Sessão não encontrada em ${storageState}. Rode primeiro: npm run ig:login`);
  process.exit(1);
}

const browser = await chromium.launch({
  headless: envBoolean("IG_HEADLESS", true),
  slowMo: envInteger("IG_SLOW_MO_MS", 80)
});

const context = await browser.newContext({
  storageState,
  viewport: { width: 1366, height: 900 }
});

const page = await context.newPage();
const collectedAt = nowIso();
const reels = [];

for (const profile of targetProfiles) {
  console.log(`[profile] coletando @${profile}`);

  await page.goto(`https://www.instagram.com/${profile}/reels/`, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await humanDelay(`perfil @${profile}`);

  const links = await collectReelLinks(page, maxReels);

  console.log(`[profile] @${profile}: ${links.length} reels encontrados`);

  for (const link of links) {
    await humanDelay(`antes de abrir reel @${profile}`);

    await page.goto(link, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await humanDelay(`lendo reel @${profile}`);

    const parsed = await parseReelPage(page, {
      profile,
      url: link,
      collectedAt
    });

    reels.push(parsed);
  }
}

const payload = {
  module: "ANALISTA_INSTAGRAM",
  collected_at: collectedAt,
  target_profiles: targetProfiles,
  count: reels.length,
  reels
};

await saveJson(payload);
await saveToSupabase(reels);

await browser.close();

async function collectReelLinks(page, limit) {
  const links = new Set();

  for (let attempt = 0; attempt < 4 && links.size < limit; attempt += 1) {
    const hrefs = await page
      .locator('a[href*="/reel/"]')
      .evaluateAll((anchors) => anchors.map((a) => a.href));

    hrefs.filter(Boolean).forEach((href) => links.add(href.split("?")[0]));

    await page.mouse.wheel(0, 900 + Math.floor(Math.random() * 400));
    await humanDelay("scroll leve");
  }

  return Array.from(links).slice(0, limit);
}
