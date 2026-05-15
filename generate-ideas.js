import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { ensureParentDir } from "./playwright/utils.js";

const analysisFile = process.env.IG_ANALYSIS_FILE || "playwright/data/reels-analysis.json";
const outputFile = process.env.IG_IDEAS_FILE || "playwright/data/ideas.json";
const apiKey = process.env.ANTHROPIC_API_KEY;

if (!apiKey) {
  console.error("[ideas] ANTHROPIC_API_KEY nao encontrada no .env");
  console.error("[ideas] Adicione: ANTHROPIC_API_KEY=sk-ant-...");
  process.exit(1);
}

if (!existsSync(analysisFile)) {
  console.error(`[ideas] arquivo nao encontrado: ${analysisFile}`);
  console.error("[ideas] rode primeiro: npm.cmd run ig:analyze");
  process.exit(1);
}

const analysis = JSON.parse(await readFile(analysisFile, "utf8"));

console.log("[ideas] lendo analise de " + analysis.total_reels + " reels...");
console.log("[ideas] enviando para Claude API...");

const topReels = analysis.top_reels_by_engagement || [];
const topHashtags = (analysis.top_hashtags || []).slice(0, 5).map(h => h.key).join(", ");
const bestHour = analysis.best_hours_to_post?.[0];
const bestDay = analysis.best_weekdays_to_post?.[0];
const topMusics = (analysis.top_musics || []).filter(m => m.key !== "Original audio").slice(0, 3).map(m => m.key).join(", ");
const insights = (analysis.insights || []).join("\n");

const reelSummary = topReels.slice(0, 5).map((r, i) =>
  `${i+1}. @${r.profile} — ${r.likes?.toLocaleString() || 0} likes, ${r.comments?.toLocaleString() || 0} comentarios\n   Descricao: ${r.description}\n   Hashtags: ${(r.hashtags||[]).join(", ") || "nenhuma"}\n   Musica: ${r.music || "original"}`
).join("\n\n");

const prompt = `Voce e um especialista em marketing digital e criacao de conteudo viral para Instagram.

Analise estes dados de reels virais coletados hoje e gere 5 ideias de conteudo viral para minha conta no Instagram.

=== DADOS DOS REELS MAIS VIRAIS ===
${reelSummary}

=== INSIGHTS GERAIS ===
${insights}
Melhor horario para postar: ${bestHour ? `${bestHour.hour}h UTC (${bestHour.hour - 4}h de Manaus, Brasil)` : "nao identificado"}
Melhor dia da semana: ${bestDay?.day || "nao identificado"}
Hashtags mais engajantes: ${topHashtags || "nao identificadas"}
Musicas em alta: ${topMusics || "audio original dominante"}

=== INSTRUCOES ===
Com base nesses dados, crie 5 ideias de conteudo viral para Instagram.

Para cada ideia retorne EXATAMENTE este JSON (sem texto fora do JSON):
{
  "ideas": [
    {
      "id": 1,
      "titulo": "titulo chamativo da ideia",
      "formato": "Reel 15s | Reel 30s | Carrossel | Post",
      "gancho": "primeira frase do video que prende atencao em 3 segundos",
      "roteiro": "roteiro completo passo a passo do que falar e mostrar",
      "hashtags": ["#hashtag1", "#hashtag2", "#hashtag3", "#hashtag4", "#hashtag5"],
      "musica_sugerida": "nome da musica ou 'audio original'",
      "melhor_horario": "horario ideal para postar",
      "por_que_vai_viralizar": "explicacao do potencial viral baseada nos dados"
    }
  ]
}

Retorne APENAS o JSON, sem markdown, sem explicacoes fora do JSON.`;

const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json",
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [{ role: "user", content: prompt }],
  }),
});

if (!response.ok) {
  const err = await response.text();
  console.error(`[ideas] erro na API: ${response.status} ${err}`);
  process.exit(1);
}

const data = await response.json();
const text = data.content?.[0]?.text || "";

let ideas;
try {
  const clean = text.replace(/```json|```/g, "").trim();
  ideas = JSON.parse(clean);
} catch {
  console.error("[ideas] erro ao parsear resposta da Claude:");
  console.error(text);
  process.exit(1);
}

const output = {
  generated_at: new Date().toISOString(),
  based_on_reels: analysis.total_reels,
  best_post_time: bestHour ? `${bestHour.hour - 4}h Manaus (${bestDay?.day || ""})` : null,
  ...ideas,
};

await ensureParentDir(outputFile);
await writeFile(outputFile, JSON.stringify(output, null, 2));

console.log(`\n[ideas] ${ideas.ideas.length} ideias salvas em ${outputFile}`);
console.log(`\n${"=".repeat(50)}`);

for (const idea of ideas.ideas) {
  console.log(`\n[${idea.id}] ${idea.titulo}`);
  console.log(`    Formato: ${idea.formato}`);
  console.log(`    Gancho: "${idea.gancho}"`);
  console.log(`    Horario: ${idea.melhor_horario}`);
  console.log(`    Hashtags: ${idea.hashtags?.join(" ")}`);
  console.log(`    Por que viraliza: ${idea.por_que_vai_viralizar}`);
  console.log(`    ---`);
  console.log(`    ROTEIRO: ${idea.roteiro}`);
}

console.log(`\n${"=".repeat(50)}`);
console.log(`[ideas] arquivo completo salvo em: ${outputFile}`);
