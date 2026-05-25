const Anthropic = require("@anthropic-ai/sdk");

async function generateConsensus(coverages, scriptTitle) {
  const client = new Anthropic.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const coverageText = coverages.map((c, i) => {
    const names = ["Claude", "ChatGPT", "Gemini", "Grok"];
    return `=== COVERAGE ${i + 1} — ${names[i] || "AI " + (i + 1)} ===\n\n${c}`;
  }).join("\n\n" + "=".repeat(60) + "\n\n");

  const systemPrompt = `You are a senior development executive analyzing multiple screenplay coverage reports on the same script. Your job is to identify patterns, agreements, and disagreements across the coverages and produce a clear consensus analysis.

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

CONSENSUS ANALYSIS — [SCRIPT TITLE]

OVERALL CONSENSUS RATING
[State the most common overall rating across all coverages — RECOMMEND, CONSIDER, or PASS — and note if there is disagreement]

WHERE ALL READERS AGREE
[List the specific notes, strengths, and weaknesses that appear across ALL coverages. These are your most reliable findings. Be specific.]

WHERE MOST READERS AGREE
[List notes that appear in the majority but not all coverages. Still highly reliable.]

WHERE READERS DISAGREE
[List areas where the coverages diverge significantly. Explain what each reader thought and why the disagreement itself is useful information for the writer.]

STRONGEST ASSETS
[The elements ALL readers identified as working well. Protect these in revision.]

PRIORITY REVISIONS — CONSENSUS VIEW
[The revision notes that appear across the most coverages, listed in order of how many readers flagged them. These are your clearest action items.]

FINAL CONSENSUS NOTE
[A single paragraph synthesis — what does the collective read tell this writer about where their script stands and what to do next?]`;

  const userPrompt = `Please analyze the following ${coverages.length} independent AI coverages of "${scriptTitle}" and produce a consensus analysis.\n\n${coverageText}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  return message.content[0].text;
}

module.exports = { generateConsensus };
