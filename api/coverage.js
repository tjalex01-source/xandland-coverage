const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");
const { GoogleGenAI } = require("@google/genai");
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
- For feature length scripts (90+ pages) provide THOROUGH and DETAILED coverage. Scene-by-scene notes should cover all major sequences across all three acts. Character notes should analyze every significant character. Dialogue notes should cite specific examples. Do not cut your analysis short — a feature script deserves a feature-length coverage of at least 10-15 pages.
- For short films (under 30 pages) provide focused coverage appropriate to the script length.
- Always complete the full coverage format below. Never stop mid-coverage.

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

async function getCoverage(scriptText, model, isFeature) {
  const maxTokens = isFeature ? 8000 : 4000;

  const userPrompt = `Please provide professional screenplay coverage for the following script. Be honest, specific, and constructive. Do not include a synopsis. ${isFeature ? "This is a feature length script — please provide thorough, detailed coverage covering all three acts extensively." : ""}\n\n${scriptText}`;

  if (model === "claude") {
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });
    return message.content[0].text;
  }

  if (model === "chatgpt") {
    const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt }
      ]
    });
    return response.choices[0].message.content;
  }

  if (model === "gemini") {
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await client.models.generateContent({
          model: "gemini-2.5-flash",
          contents: SYSTEM_PROMPT + "\n\n" + userPrompt,
          config: {
            maxOutputTokens: maxTokens
          }
        });
        return result.text;
      } catch (err) {
        lastError = err;
        if (err.status === 503 && attempt < 3) {
          console.log(`Gemini 503 on attempt ${attempt}, retrying in ${attempt * 3}s...`);
          await new Promise(r => setTimeout(r, attempt * 3000));
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
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: "grok-beta",
          max_tokens: maxTokens,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ]
        });
        return response.choices[0].message.content;
      } catch (err) {
        lastError = err;
        if ((err.status === 503 || err.status === 429) && attempt < 3) {
          console.log(`Grok error on attempt ${attempt}, retrying in ${attempt * 3}s...`);
          await new Promise(r => setTimeout(r, attempt * 3000));
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

    const { scriptText, tier, scriptTitle, emailAddress, sessionId } = JSON.parse(body);

    if (!scriptText) return res.status(400).json({ error: "No script text provided" });

    const title = scriptTitle || "Untitled Script";
    const tierNum = parseInt(tier) || 1;

    // Detect feature vs short film based on text length
    // 15000 characters is roughly 30 pages
    const isFeature = scriptText.length > 15000;

    console.log(`Script length: ${scriptText.length} chars — ${isFeature ? "Feature" : "Short film"}`);

    let coverageTexts = [];
    let outputBuffer;
    let filename;
    let contentType;

    if (tierNum === 1) {
      // ── TIER 1 — Claude only, single PDF ──
      const coverage = await getCoverage(scriptText, "claude", isFeature);
      coverageTexts = [coverage];
      outputBuffer = await generateCoveragePDF(coverage, title, "Claude");
      filename = `Xandland_Coverage_${title.replace(/\s+/g, "_")}.pdf`;
      contentType = "application/pdf";

    } else if (tierNum === 2) {
      // ── TIER 2 — Claude, ChatGPT, Gemini in parallel ──
      const [claude, chatgpt, gemini] = await Promise.all([
        getCoverage(scriptText, "claude", isFeature),
        getCoverage(scriptText, "chatgpt", isFeature),
        getCoverage(scriptText, "gemini", isFeature)
      ]);
      coverageTexts = [claude, chatgpt, gemini];
      const consensus = await generateConsensus(coverageTexts, title);
      outputBuffer = await generateZip(coverageTexts, consensus, title);
      filename = `Xandland_Triple_Coverage_${title.replace(/\s+/g, "_")}.zip`;
      contentType = "application/zip";

    } else if (tierNum === 3) {
      // ── TIER 3 — Claude, ChatGPT, Gemini, Grok in parallel ──
      const [claude, chatgpt, gemini, grok] = await Promise.all([
        getCoverage(scriptText, "claude", isFeature),
        getCoverage(scriptText, "chatgpt", isFeature),
        getCoverage(scriptText, "gemini", isFeature),
        getCoverage(scriptText, "grok", isFeature)
      ]);
      coverageTexts = [claude, chatgpt, gemini, grok];
      const consensus = await generateConsensus(coverageTexts, title);
      outputBuffer = await generateZip(coverageTexts, consensus, title);
      filename = `Xandland_Quad_Coverage_${title.replace(/\s+/g, "_")}.zip`;
      contentType = "application/zip";
    }

    // ── EMAIL — get address from Stripe if not provided ──
    let emailTo = emailAddress;

    if (!emailTo && sessionId) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        emailTo = session.customer_details?.email || "";
      } catch (stripeErr) {
        console.error("Stripe email lookup failed:", stripeErr.message);
      }
    }

    if (emailTo && coverageTexts.length > 0) {
      try {
        await sendCoverageEmail(emailTo, title, outputBuffer, tierNum);
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
    return res.status(500).json({
      error: "Failed to generate coverage",
      details: error.message
    });
  }
};
