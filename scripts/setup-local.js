import { access, copyFile, mkdir, writeFile } from "node:fs/promises";

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function ensureDir(path) {
  await mkdir(path, { recursive: true });
  console.log(`pasta pronta: ${path}`);
}

async function ensureGitkeep(path) {
  if (!(await exists(path))) await writeFile(path, "");
}

await ensureDir("playwright/data");
await ensureDir("playwright/.auth");
await ensureGitkeep("playwright/data/.gitkeep");
await ensureGitkeep("playwright/.auth/.gitkeep");

if (!(await exists(".env"))) {
  await copyFile(".env.example", ".env");
  console.log("arquivo .env criado a partir de .env.example");
  console.log("edite o .env antes de rodar login/coleta.");
} else {
  console.log("arquivo .env já existe; não alterei.");
}

console.log("Próximos passos:");
console.log("1) npm install");
console.log("2) npx playwright install chromium");
console.log("3) npm run ig:login");
console.log("4) npm run ig:collect");
