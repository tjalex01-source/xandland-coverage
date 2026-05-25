const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { generateCoveragePDF } = require("./generate-pdf");
const { generateConsensus } = require("./consensus");
const { generateZip } = require("./generate-zip");
const { sendCoverageEmail } = require("./send-email");

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
[2-3 paragraphs giving an honest overall assessment]

SCENE-BY-SCENE NOTES
[For each significant scene or sequence, provide:]
SCENE: [Scene name/location]
ISSUE: [What isn't working and why]
SUGGESTION: [Specific, actionable fix]

CHARACTER NOTES
[Analysis of each major character with specific development suggestions]

DIALOGUE NOTES
[Specific dialogue strengths and weaknesses with examples]

SUMMARY AND PRIORITY REVISIONS
[Bulleted list of revisions in order of importance]

OVERALL RECOMMENDATION: [RECOMMEND / CONSIDER / PASS]
[One final sentence]`;

async function getCoverage(scriptText, model) {
  const userPrompt = `Please provide professional screenplay coverage for the following script. Be honest, specific, and constructive. Do not include a synopsis.\n\n${scriptText}`;

  if (model === "claude") {
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });
    return message.content[0].text;
  }

  if (model === "chatgpt") {
    const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    });
    return response.choices[0].message.content;
  }

if (model === "gemini") {
    const client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const geminiModel = client.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await geminiModel.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: SYSTEM_PROMPT + "\n\n" + userPrompt }]
        }
      ]
    });
    return result.response.text();
  }

  if (model === "grok") {
    const client = new OpenAI.default({
      apiKey: process.env.GROK_API_KEY,
      baseURL: "https://api.x.ai/v1"
    });
    const response = await client.chat.completions.create({
      model: "grok-beta",
      max_tokens: 4000,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    });
    return response.choices[0].message.content;
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

    const { scriptText, tier, scriptTitle, emailAddress } = JSON.parse(body);

    if (!scriptText) return res.status(400).json({ error: "No script text provided" });

    const title = scriptTitle || "Untitled Script";
    const tierNum = parseInt(tier) || 1;

    let coverageTexts = [];
    let outputBuffer;
    let filename;
    let contentType;

    if (tierNum === 1) {
      // ── TIER 1 — Claude only, single PDF ──
      const coverage = await getCoverage(scriptText, "claude");
      coverageTexts = [coverage];
      outputBuffer = await generateCoveragePDF(coverage, title, "Claude");
      filename = `Xandland_Coverage_${title.replace(/\s+/g, "_")}.pdf`;
      contentType = "application/pdf";

    } else if (tierNum === 2) {
      // ── TIER 2 — Claude, ChatGPT, Gemini in parallel ──
      const [claude, chatgpt, gemini] = await Promise.all([
        getCoverage(scriptText, "claude"),
        getCoverage(scriptText, "chatgpt"),
        getCoverage(scriptText, "gemini")
      ]);
      coverageTexts = [claude, chatgpt, gemini];
      const consensus = await generateConsensus(coverageTexts, title);
      outputBuffer = await generateZip(coverageTexts, consensus, title);
      filename = `Xandland_Triple_Coverage_${title.replace(/\s+/g, "_")}.zip`;
      contentType = "application/zip";

    } else if (tierNum === 3) {
      // ── TIER 3 — Claude, ChatGPT, Gemini, Grok in parallel ──
      const [claude, chatgpt, gemini, grok] = await Promise.all([
        getCoverage(scriptText, "claude"),
        getCoverage(scriptText, "chatgpt"),
        getCoverage(scriptText, "gemini"),
        getCoverage(scriptText, "grok")
      ]);
      coverageTexts = [claude, chatgpt, gemini, grok];
      const consensus = await generateConsensus(coverageTexts, title);
      outputBuffer = await generateZip(coverageTexts, consensus, title);
      filename = `Xandland_Quad_Coverage_${title.replace(/\s+/g, "_")}.zip`;
      contentType = "application/zip";
    }

    // ── EMAIL ──
    if (emailAddress && coverageTexts.length > 0) {
      try {
        const emailPdf = tierNum === 1
          ? outputBuffer
          : await generateCoveragePDF(coverageTexts[0], title, "Claude");
        await sendCoverageEmail(emailAddress, title, emailPdf);
      } catch (emailErr) {
        console.error("Email failed:", emailErr.message);
      }
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", outputBuffer.length);
    return res.end(outputBuffer);

  } catch (error) {
    console.error("Coverage error:", error);
    return res.status(500).json({ error: "Failed to generate coverage", details: error.message });
  }
};
