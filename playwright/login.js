import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { envBoolean, envInteger, humanDelay } from "./utils.js";

const storageState = process.env.IG_STORAGE_STATE || "playwright/.auth/instagram.json";

const browser = await chromium.launch({
  headless: envBoolean("IG_HEADLESS", false),
  slowMo: envInteger("IG_SLOW_MO_MS", 80)
});

const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome Safari"
});

const page = await context.newPage();

console.log("[login] abrindo Instagram...");
console.log("[login] faça login manualmente na janela que abriu.");
console.log("[login] se aparecer código, captcha ou confirmação no celular, resolva manualmente.");

await page.goto("https://www.instagram.com/accounts/login/", {
  waitUntil: "domcontentloaded",
  timeout: 60000
});

console.log("[login] você tem 60 segundos para entrar na conta.");
console.log("[login] depois disso vou salvar a sessão automaticamente.");

await page.waitForTimeout(60000);

await humanDelay("antes de salvar sessão");

await mkdir(dirname(storageState), { recursive: true });
await context.storageState({ path: storageState });

console.log(`[login] sessão salva em ${storageState}`);
console.log("[login] agora você pode rodar: npm.cmd run ig:collect");

await browser.close();