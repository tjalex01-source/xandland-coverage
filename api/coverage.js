const Anthropic = require("@anthropic-ai/sdk");
const { generateCoveragePDF } = require("./generate-pdf");

module.exports = async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body = "";
    await new Promise((resolve, reject) => {
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", resolve);
      req.on("error", reject);
    });

    const { scriptText, tier, scriptTitle } = JSON.parse(body);

    if (!scriptText) {
      return res.status(400).json({ error: "No script text provided" });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

    const client = new Anthropic.default({
      apiKey: apiKey,
    });

    const systemPrompt = `You are a professional screenplay coverage reader with years of experience in the film industry. Your job is to provide honest, accurate, and constructive coverage of screenplays.

RATING DEFINITIONS:
- RECOMMEND: The script demonstrates professional-level craft and could move toward production with moderate revisions. It does not need to be perfect.
- CONSIDER: The script shows promise but requires significant development work before it is production-ready.
- PASS: The script has fundamental problems that would require substantial rewriting.

CRITICAL INSTRUCTIONS:
- Evaluate each script independently on its own merits
- Do not compare it to other scripts you have evaluated
- Do not inflate ratings to make writers feel good
- Do not artificially suppress ratings — if a script genuinely deserves a RECOMMEND, give it one
- If ten consecutive scripts deserve a RECOMMEND, give them all a RECOMMEND
- If ten consecutive scripts deserve a PASS, give them all a PASS
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

    const userPrompt = `Please provide professional screenplay coverage for the following script. Be honest, specific, and constructive. Do not include a synopsis.\n\n${scriptText}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const coverageText = message.content[0].text;
    const title = scriptTitle || "Untitled Script";

    // Generate PDF
    const pdfBuffer = await generateCoveragePDF(coverageText, title);

    // Return PDF as downloadable file
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Screenreads_Coverage_${title.replace(/\s+/g, "_")}.pdf"`
    );
    res.setHeader("Content-Length", pdfBuffer.length);

    return res.end(pdfBuffer);

  } catch (error) {
    console.error("Coverage generation error:", error);
    return res.status(500).json({
      error: "Failed to generate coverage",
      details: error.message
    });
  }
};
