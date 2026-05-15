import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ensureParentDir } from "./playwright/utils.js";

const inputFile = process.env.IG_OUTPUT_FILE || "playwright/data/reels-capture.json";
const outputFile = process.env.IG_ANALYSIS_FILE || "playwright/data/reels-analysis.json";

if (!existsSync(inputFile)) {
  console.error(`[analyze] arquivo não encontrado: ${inputFile}`);
  console.error(`[analyze] rode primeiro: npm.cmd run ig:collect`);
  process.exit(1);
}

const raw = JSON.parse(await readFile(inputFile, "utf8"));
const reels = raw.reels || [];

if (!reels.length) {
  console.error("[analyze] nenhum reel encontrado no arquivo.");
  process.exit(1);
}

console.log(`[analyze] analisando ${reels.length} reels...`);

function parseNumber(text) {
  if (!text) return 0;
  const t = String(text).toLowerCase().replace(/\s/g, "");
  const m = t.match(/([\d.,]+)(k|m|b|mil|mi)?/);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(",", "."));
  if (m[2] === "k" || m[2] === "mil") return Math.round(n * 1000);
  if (m[2] === "m" || m[2] === "mi") return Math.round(n * 1000000);
  if (m[2] === "b") return Math.round(n * 1000000000);
  return Math.round(n);
}

function extractLikesFromDescription(description) {
  if (!description) return 0;
  const m = description.match(/([\d.,]+[KkMmBb]?)\s*likes?/i);
  return m ? parseNumber(m[1]) : 0;
}

function extractCommentsFromDescription(description) {
  if (!description) return 0;
  const m = description.match(/([\d.,]+[KkMmBb]?)\s*comments?/i);
  return m ? parseNumber(m[1]) : 0;
}

function getHour(isoDate) {
  if (!isoDate) return null;
  return new Date(isoDate).getUTCHours();
}

function getWeekday(isoDate) {
  if (!isoDate) return null;
  const days = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  return days[new Date(isoDate).getUTCDay()];
}

const enriched = reels.map((r) => {
  const likes = r.metrics?.likes ?? extractLikesFromDescription(r.description);
  const comments = r.metrics?.comments ?? extractCommentsFromDescription(r.description);
  const views = r.metrics?.views ?? 0;
  const engagement = likes + comments * 2 + views * 0.1;

  return {
    ...r,
    _likes: likes,
    _comments: comments,
    _views: views,
    _engagement: Math.round(engagement),
    _hour: getHour(r.published_at),
    _weekday: getWeekday(r.published_at),
  };
});

function topN(map, n = 5) {
  return Object.entries(map)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, n)
    .map(([key, val]) => ({ key, ...val }));
}

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}

const byProfile = {};
const byHour = {};
const byWeekday = {};
const byMusic = {};
const hashtagMap = {};

for (const r of enriched) {
  const p = r.profile;
  if (!byProfile[p]) byProfile[p] = { reels: [], likes: [], comments: [], engagement: [] };
  byProfile[p].reels.push(r);
  byProfile[p].likes.push(r._likes);
  byProfile[p].comments.push(r._comments);
  byProfile[p].engagement.push(r._engagement);

  if (r._hour !== null) {
    if (!byHour[r._hour]) byHour[r._hour] = { total: 0, count: 0 };
    byHour[r._hour].total += r._engagement;
    byHour[r._hour].count += 1;
  }

  if (r._weekday) {
    if (!byWeekday[r._weekday]) byWeekday[r._weekday] = { total: 0, count: 0 };
    byWeekday[r._weekday].total += r._engagement;
    byWeekday[r._weekday].count += 1;
  }

  if (r.music) {
    const key = r.music.trim();
    if (!byMusic[key]) byMusic[key] = { total: 0, count: 0, reels: [] };
    byMusic[key].total += r._engagement;
    byMusic[key].count += 1;
    byMusic[key].reels.push(r.reel_url);
  }

  for (const tag of r.hashtags || []) {
    if (!hashtagMap[tag]) hashtagMap[tag] = { total: 0, count: 0 };
    hashtagMap[tag].total += r._engagement;
    hashtagMap[tag].count += 1;
  }
}

const profileSummary = Object.entries(byProfile).map(([profile, data]) => ({
  profile,
  reels_count: data.reels.length,
  avg_likes: avg(data.likes),
  avg_comments: avg(data.comments),
  avg_engagement: avg(data.engagement),
  top_reel: data.reels.sort((a, b) => b._engagement - a._engagement)[0]?.reel_url || null,
}));

const topHours = Object.entries(byHour)
  .map(([hour, d]) => ({ hour: Number(hour), avg_engagement: Math.round(d.total / d.count), count: d.count }))
  .sort((a, b) => b.avg_engagement - a.avg_engagement)
  .slice(0, 5);

const topWeekdays = Object.entries(byWeekday)
  .map(([day, d]) => ({ day, avg_engagement: Math.round(d.total / d.count), count: d.count }))
  .sort((a, b) => b.avg_engagement - a.avg_engagement);

const topMusics = topN(byMusic, 5);
const topHashtags = topN(hashtagMap, 10);

const topReels = [...enriched]
  .sort((a, b) => b._engagement - a._engagement)
  .slice(0, 5)
  .map((r) => ({
    profile: r.profile,
    url: r.reel_url,
    likes: r._likes,
    comments: r._comments,
    engagement: r._engagement,
    music: r.music,
    hashtags: r.hashtags,
    description: r.description?.slice(0, 120) + "...",
    published_at: r.published_at,
    hour: r._hour,
    weekday: r._weekday,
  }));

const analysis = {
  generated_at: new Date().toISOString(),
  source_file: inputFile,
  total_reels: reels.length,
  profiles: profileSummary,
  top_reels_by_engagement: topReels,
  best_hours_to_post: topHours,
  best_weekdays_to_post: topWeekdays,
  top_musics: topMusics,
  top_hashtags: topHashtags,
  insights: generateInsights(topReels, topHours, topWeekdays, topMusics, topHashtags),
};

function generateInsights(topReels, topHours, topWeekdays, topMusics, topHashtags) {
  const insights = [];

  if (topReels.length) {
    const best = topReels[0];
    insights.push(`Reel mais viral: @${best.profile} com ${best.likes.toLocaleString()} likes e ${best.comments.toLocaleString()} comentários.`);
  }

  if (topHours.length) {
    const h = topHours[0];
    insights.push(`Melhor horário para postar: ${h.hour}h UTC (${h.hour - 4}h Manaus) — maior engajamento médio.`);
  }

  if (topWeekdays.length) {
    insights.push(`Melhor dia da semana: ${topWeekdays[0].day}.`);
  }

  if (topMusics.length) {
    const m = topMusics[0];
    if (m.key !== "Original audio") {
      insights.push(`Música mais engajante: "${m.key}" — apareceu em ${m.count} reels.`);
    } else if (topMusics[1]) {
      insights.push(`Além de áudio original, a música mais usada foi: "${topMusics[1].key}".`);
    }
  }

  if (topHashtags.length) {
    const tags = topHashtags.slice(0, 3).map((t) => t.key).join(", ");
    insights.push(`Hashtags com mais engajamento: ${tags}.`);
  }

  return insights;
}

await ensureParentDir(outputFile);
await writeFile(outputFile, JSON.stringify(analysis, null, 2));

console.log(`\n[analyze] análise salva em ${outputFile}`);
console.log(`\n━━━ INSIGHTS ━━━`);
for (const insight of analysis.insights) {
  console.log(`• ${insight}`);
}
console.log(`\n━━━ TOP 3 REELS ━━━`);
for (const r of analysis.top_reels_by_engagement.slice(0, 3)) {
  console.log(`@${r.profile} | ${r.likes.toLocaleString()} likes | ${r.comments.toLocaleString()} coments | ${r.weekday} ${r.hour}h UTC`);
  console.log(`  ${r.url}`);
}
console.log(`\n━━━ MELHORES HORÁRIOS ━━━`);
for (const h of analysis.best_hours_to_post) {
  console.log(`  ${h.hour}h UTC (${h.hour - 4}h Manaus) — engajamento médio: ${h.avg_engagement.toLocaleString()}`);
}