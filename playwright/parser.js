export function parseCompactNumber(value) {
  if (!value) return null;

  const text = String(value).trim().toLowerCase();
  const match = text.match(/([\d.,]+)\s*(million|billion|mil|mi|k|m|b)?/i);

  if (!match) return null;

  const suffix = match[2];
  const numericToken = match[1];
  const normalized = suffix
    ? numericToken.replace(",", ".")
    : numericToken.replace(/[.,]/g, "");

  const number = Number.parseFloat(normalized);

  if (!Number.isFinite(number)) return null;

  if (suffix === "k" || suffix === "mil") return Math.round(number * 1000);
  if (suffix === "m" || suffix === "mi" || suffix === "million") return Math.round(number * 1000000);
  if (suffix === "b" || suffix === "billion") return Math.round(number * 1000000000);

  return Math.round(number);
}

export function extractHashtags(text = "") {
  return Array.from(
    new Set((text.match(/#[\p{L}\p{N}_]+/gu) || []).map((tag) => tag.toLowerCase()))
  );
}

export function normalizeWhitespace(text = "") {
  return text.replace(/\s+/g, " ").trim();
}

export function extractDuration(text = "") {
  const normalized = normalizeWhitespace(text);
  const match = normalized.match(/(\d{1,2}:\d{2}|\d{1,3})\s*(s|sec|seg|seconds|second|segundos)?/i);

  if (!match) return null;

  if (match[1].includes(":")) {
    const [minutes, seconds] = match[1].split(":").map(Number);
    return minutes * 60 + seconds;
  }

  return Number(match[1]);
}

export function extractMetricText(text = "", labels = []) {
  const alternatives = labels.join("|");
  const pattern = new RegExp(
    `([\\d.,]+\\s*(?:million|billion|mil|mi|k|m|b)?)\\s*(?:${alternatives})`,
    "i"
  );

  return normalizeWhitespace(text).match(pattern)?.[1] || null;
}

export async function readFirstText(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();

    if (await locator.count()) {
      const text = normalizeWhitespace(await locator.innerText().catch(() => ""));

      if (text) return text;
    }
  }

  return null;
}

export async function readMetaContent(page, property) {
  const selector = `meta[property="${property}"], meta[name="${property}"]`;
  const locator = page.locator(selector).first();

  if (!(await locator.count())) return null;

  return normalizeWhitespace(await locator.getAttribute("content").catch(() => "") || "");
}

export async function parseReelPage(page, { profile, url, collectedAt }) {
  const ogDescription = await readMetaContent(page, "og:description");
  const pageText = normalizeWhitespace(await page.locator("body").innerText({ timeout: 8000 }).catch(() => ""));
  const description = await readFirstText(page, [
    "article h1",
    'article span[dir="auto"]',
    "main h1"
  ]) || ogDescription;

  const title = await readMetaContent(page, "og:title");
  const combinedText = `${pageText} ${ogDescription || ""}`;

  const likeText = extractMetricText(combinedText, ["likes?", "curtidas?"]);
  const commentText = extractMetricText(combinedText, ["comments?", "coment[aá]rios?"]);
  const viewText = extractMetricText(combinedText, ["views?", "visualiza[cç][oõ]es?", "reprodu[cç][oõ]es?"]);

  const time = await page.locator("time").first().getAttribute("datetime").catch(() => null);

  const music = await readFirstText(page, [
    'a[href*="/reels/audio/"]',
    'a[href*="/music/"]',
    'span:has-text("Original audio")',
    'span:has-text("Áudio original")'
  ]);

  const durationSeconds = extractDuration(pageText);

  return {
    source: "instagram_playwright",
    profile,
    reel_url: url,
    collected_at: collectedAt,
    metrics: {
      views: parseCompactNumber(viewText),
      likes: parseCompactNumber(likeText),
      comments: parseCompactNumber(commentText)
    },
    hashtags: extractHashtags(description || pageText),
    description: description || null,
    music: music || null,
    published_at: time,
    duration_seconds: durationSeconds,
    raw: {
      title,
      og_description: ogDescription,
      parser_note: "Campos podem variar conforme idioma, layout e permissões do Instagram."
    }
  };
}
