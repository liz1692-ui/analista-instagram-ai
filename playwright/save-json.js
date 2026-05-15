import { readFile, writeFile } from "node:fs/promises";
import { ensureParentDir } from "./utils.js";

export async function saveJson(payload, outputFile = process.env.IG_OUTPUT_FILE || "playwright/data/reels-capture.json") {
  await ensureParentDir(outputFile);
  await writeFile(outputFile, JSON.stringify(payload, null, 2));

  console.log(`[json] salvo em ${outputFile}`);

  return outputFile;
}

export async function saveToSupabase(reels) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const table = process.env.SUPABASE_TABLE || "instagram_reels";

  if (!url || !key) {
    console.log("[supabase] variáveis ausentes; pulando Supabase.");
    return { skipped: true, count: 0 };
  }

  const rows = reels.map((reel) => ({
    profile: reel.profile,
    reel_url: reel.reel_url,
    collected_at: reel.collected_at,
    views: reel.metrics?.views ?? null,
    likes: reel.metrics?.likes ?? null,
    comments: reel.metrics?.comments ?? null,
    hashtags: reel.hashtags || [],
    description: reel.description,
    music: reel.music,
    published_at: reel.published_at,
    duration_seconds: reel.duration_seconds,
    raw: reel
  }));

  const endpoint = `${url.replace(/\/$/, "")}/rest/v1/${encodeURIComponent(table)}?on_conflict=reel_url`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`[supabase] falha ${response.status}: ${message}`);
  }

  console.log(`[supabase] ${rows.length} reels enviados para ${table}`);

  return { skipped: false, count: rows.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inputFile = process.argv[2] || process.env.IG_OUTPUT_FILE || "playwright/data/reels-capture.json";
  const payload = JSON.parse(await readFile(inputFile, "utf8"));

  await saveToSupabase(payload.reels || []);
}
