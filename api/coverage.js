const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");
const { GoogleGenAI } = require("@google/genai");

// ── STRIP MARKDOWN ──
function stripMarkdown(text) {
  return text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^---+$/gm, "")
    .replace(/^___+$/gm, "")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "- ")
    .replace(/\[(.+?)\]\(.+?\)/g, "$1")
    .trim();
}

// ── STANDARD SYSTEM PROMPT ──
const SYSTEM_PROMPT = `You are a professional screenplay coverage reader with years of experience in the film industry. Your job is to provide honest, accurate, and constructive coverage of screenplays.

RATING DEFINITIONS:
- RECOMMEND: The script demonstrates professional-level craft and could move toward production with moderate revisions. It does not need to be perfect.
- CONSIDER: The script shows promise but requires significant development work before it is production-ready.
- PASS: The script has fundamental problems that would require substantial rewriting.

CRITICAL INSTRUCTIONS:
- Evaluate each script independently on its own merits
- Do not inflate ratings to make writers feel good
- Do not artificially suppress ratings — if a script genuinely deserves a RECOMMEND, give it one
- Your job is honest evaluation, not distribution management
- A RECOMMEND does not mean perfect — it means production-ready with moderate revisions
- Do NOT include a synopsis — the writer already knows their story
- For feature length scripts (90+ pages) you MUST provide THOROUGH and DETAILED coverage of AT LEAST 10-12 pages. Scene-by-scene notes MUST cover all major sequences across ALL THREE ACTS with at minimum 15-20 scene notes. Character notes MUST analyze every significant character in depth. Dialogue notes MUST cite specific examples from the script. Do NOT produce a short coverage. Do NOT summarize. Do NOT stop early. Provide the full professional analysis the writer is paying for. A coverage that is fewer than 10 pages for a feature script is unacceptable and incomplete.
- For short films (under 30 pages) provide focused coverage appropriate to the script length.
- Always complete the full coverage format below. Never stop mid-coverage.
- Do NOT use markdown formatting. Do not use # headers, ** bold, * italic, --- dividers, or backticks. Use plain text only.

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

LOGLINE
[Write a single compelling logline]

RATINGS
Premise: [RECOMMEND / CONSIDER / PASS]
Story/Structure: [RECOMMEND / CONSIDER / PASS]
Character: [RECOMMEND / CONSIDER / PASS]
Dialogue: [RECOMMEND / CONSIDER / PASS]
Marketability: [RECOMMEND / CONSIDER / PASS]
Overall: [RECOMMEND / CONSIDER / PASS]

OVERVIEW
[3-4 paragraphs giving an honest overall assessment. For feature scripts this should be comprehensive.]

SCENE-BY-SCENE NOTES
[For each significant scene or sequence across ALL THREE ACTS, provide:]
SCENE: [Scene name/location]
ISSUE: [What isn't working and why]
SUGGESTION: [Specific, actionable fix]

CHARACTER NOTES
[Analysis of EVERY significant character with specific development suggestions]

DIALOGUE NOTES
[Specific dialogue strengths and weaknesses with examples from the script]

SUMMARY AND PRIORITY REVISIONS
[Bulleted list of revisions in order of importance — at least 8-10 items for a feature]

OVERALL RECOMMENDATION: [RECOMMEND / CONSIDER / PASS]
[One final sentence]`;

// ── GEMINI SYSTEM PROMPT ──
const GEMINI_SYSTEM_PROMPT = `You are a professional screenplay coverage reader with years of experience in the film industry. Your job is to provide honest, accurate, and constructive coverage of screenplays.

RATING DEFINITIONS:
- RECOMMEND: The script demonstrates professional-level craft and could move toward production with moderate revisions. It does not need to be perfect.
- CONSIDER: The script shows promise but requires significant development work before it is production-ready.
- PASS: The script has fundamental problems that would require substantial rewriting.

CRITICAL LENGTH REQUIREMENT — THIS IS MANDATORY:
For a feature length script you MUST write a minimum of 4,500 words. This is not optional. Your coverage will be rejected if it is under 4,500 words. Every section must be fully developed. Do not summarize. Do not be brief. Write in full, complete, detailed paragraphs for every section. Think of this as a comprehensive professional document, not a quick summary.

CRITICAL INSTRUCTIONS:
- Evaluate each script independently on its own merits
- Do not inflate ratings to make writers feel good
- Do not artificially suppress ratings — if a script genuinely deserves a RECOMMEND, give it one
- Your job is honest evaluation, not distribution management
- A RECOMMEND does not mean perfect — it means production-ready with moderate revisions
- Do NOT include a synopsis — the writer already knows their story
- You MUST provide scene-by-scene notes for at least 15-20 individual scenes covering ALL THREE ACTS
- You MUST analyze EVERY significant character in depth — at least 2-3 paragraphs per major character
- You MUST cite specific examples from the script in your dialogue notes
- You MUST provide at least 10 detailed priority revision items
- Do NOT use markdown formatting. Use plain text only. No # headers, no ** bold, no * italic, no --- dividers.

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

LOGLINE
[Write a single compelling logline]

RATINGS
Premise: [RECOMMEND / CONSIDER / PASS]
Story/Structure: [RECOMMEND / CONSIDER / PASS]
Character: [RECOMMEND / CONSIDER / PASS]
Dialogue: [RECOMMEND / CONSIDER / PASS]
Marketability: [RECOMMEND / CONSIDER / PASS]
Overall: [RECOMMEND / CONSIDER / PASS]

OVERVIEW
[Write at least 4 full paragraphs giving a comprehensive overall assessment. Each paragraph must be at least 150 words. Do not be brief here.]

SCENE-BY-SCENE NOTES
[For EVERY significant scene across ALL THREE ACTS — minimum 15 scenes — provide:]
SCENE: [Scene name/location]
ISSUE: [Write at least 3-4 sentences explaining what isn't working and why in specific detail]
SUGGESTION: [Write at least 3-4 sentences with a specific, actionable, detailed fix]

CHARACTER NOTES
[For EVERY significant character write at least 2-3 full paragraphs of detailed analysis with specific development suggestions]

DIALOGUE NOTES
[Write at least 3-4 paragraphs with specific examples quoted or referenced from the script. Identify both strengths and weaknesses in detail.]

SUMMARY AND PRIORITY REVISIONS
[Write at least 10 detailed bullet points in order of importance. Each bullet point must be at least 2-3 sentences explaining the revision and why it matters.]

OVERALL RECOMMENDATION: [RECOMMEND / CONSIDER / PASS]
[Write 2-3 sentences as your final assessment]`;

async function getCoverage(scriptText, model, isFeature) {
  const maxTokens = isFeature ? 12000 : 4000;

  const userPrompt = `Please provide professional screenplay coverage for the following script. Be honest, specific, and constructive. Do not include a synopsis. Do NOT use markdown formatting — use plain text only. ${isFeature ? "This is a feature length script of 90+ pages. You MUST write at least 4,500 words of coverage minimum. Cover ALL THREE ACTS thoroughly. Write at least 15-20 scene notes. Analyze every major character in depth with multiple paragraphs each. Do not stop early. Do not summarize. Write the complete coverage from beginning to end without cutting anything short. Incomplete or short coverage is unacceptable and will be rejected." : ""}\n\n${scriptText}`;

  const geminiUserPrompt = `Please provide professional screenplay coverage for the following script. Be honest, specific, and constructive. Do not include a synopsis. Do NOT use markdown formatting — use plain text only. ${isFeature ? "MANDATORY: This is a feature length script. You MUST write at minimum 4,500 words. You MUST cover at least 15-20 individual scenes across all three acts. You MUST write at least 2-3 paragraphs per major character. You MUST provide at least 10 detailed revision items. Every section must be fully written out in detail. Do not summarize. Do not be brief. Do not stop until you have written at least 4,500 words of thorough professional analysis." : ""}\n\n${scriptText}`;

  if (model === "claude") {
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });
    return stripMarkdown(message.content[0].text);
  }

  if (model === "chatgpt") {
    const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ]
        });
        return stripMarkdown(response.choices[0].message.content);
      } catch (err) {
        lastError = err;
        if ((err.status === 503 || err.status === 429) && attempt < 3) {
          const waitSeconds = attempt * 10;
          console.log(`ChatGPT error on attempt ${attempt}, retrying in ${waitSeconds}s...`);
          await new Promise(r => setTimeout(r, waitSeconds * 1000));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  }

  if (model === "gemini") {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const result = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: GEMINI_SYSTEM_PROMPT + "\n\n" + geminiUserPrompt,
          config: { maxOutputTokens: maxTokens }
        });
        return stripMarkdown(result.text);
      } catch (err) {
        lastError = err;
        if (err.status === 503 && attempt < 4) {
          const waitSeconds = attempt * 10;
          console.log(`Gemini 503 on attempt ${attempt}, retrying in ${waitSeconds}s...`);
          await new Promise(r => setTimeout(r, waitSeconds * 1000));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  }

  if (model === "grok") {
    const client = new OpenAI.default({
      apiKey: process.env.GROK_API_KEY,
      baseURL: "https://api.x.ai/v1"
    });
    let lastError;
    for (let attempt = 1; attempt <= 4; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: "grok-beta",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ]
        });
        return stripMarkdown(response.choices[0].message.content);
      } catch (err) {
        lastError = err;
        if ((err.status === 503 || err.status === 429) && attempt < 4) {
          const waitSeconds = attempt * 10;
          console.log(`Grok error on attempt ${attempt}, retrying in ${waitSeconds}s...`);
          await new Promise(r => setTimeout(r, waitSeconds * 1000));
        } else {
          throw err;
        }
      }
    }
    throw lastError;
  }

  throw new Error("Unknown model: " + model);
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    let body = "";
    await new Promise((resolve, reject) => {
      req.on("data", chunk => { body += chunk.toString(); });
      req.on("end", resolve);
      req.on("error", reject);
    });

    const { scriptText, tier, scriptTitle } = JSON.parse(body);

    if (!scriptText) return res.status(400).json({ error: "No script text provided" });

    const title   = scriptTitle || "Untitled Script";
    const tierNum = parseInt(tier) || 1;
    const isFeature = scriptText.length > 15000;

    console.log(`Script: "${title}" | Length: ${scriptText.length} chars | ${isFeature ? "Feature" : "Short"} | Tier: ${tierNum}`);

    let coverageTexts = [];

    if (tierNum === 1) {
      const coverage = await getCoverage(scriptText, "claude", isFeature);
      coverageTexts = [coverage];

    } else if (tierNum === 2) {
      const [claude, chatgpt, gemini] = await Promise.all([
        getCoverage(scriptText, "claude", isFeature),
        getCoverage(scriptText, "chatgpt", isFeature),
        getCoverage(scriptText, "gemini", isFeature)
      ]);
      coverageTexts = [claude, chatgpt, gemini];

    } else if (tierNum === 3) {
      const [claude, chatgpt, gemini, grok] = await Promise.all([
        getCoverage(scriptText, "claude", isFeature),
        getCoverage(scriptText, "chatgpt", isFeature),
        getCoverage(scriptText, "gemini", isFeature),
        getCoverage(scriptText, "grok", isFeature)
      ]);
      coverageTexts = [claude, chatgpt, gemini, grok];
    }

    // Return coverage texts as JSON — assembly happens in /api/assemble
    return res.status(200).json({
      success: true,
      coverageTexts,
      scriptTitle: title,
      tier: tierNum,
      isFeature
    });

  } catch (error) {
    console.error("Coverage error:", error);
    return res.status(500).json({
      error:   "Failed to generate coverage",
      details: error.message
    });
  }
};
