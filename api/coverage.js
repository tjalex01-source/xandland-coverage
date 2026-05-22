import Anthropic from "@anthropic-ai/sdk";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "10mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { scriptText, tier } = req.body;

    if (!scriptText) {
      return res.status(400).json({ error: "No script text provided" });
    }

    const client = new Anthropic();

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
      model: "claude-opus-4-6",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const coverage = message.content[0].text;

    return res.status(200).json({ coverage });
  } catch (error) {
    console.error("Coverage generation error:", error);
    return res.status(500).json({ error: "Failed to generate coverage" });
  }
}
