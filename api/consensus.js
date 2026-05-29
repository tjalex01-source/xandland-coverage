const Anthropic = require("@anthropic-ai/sdk");

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

async function generateConsensus(coverages, scriptTitle) {
  const client = new Anthropic.default({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const coverageText = coverages.map((c, i) => {
    const names = ["Claude", "ChatGPT", "Gemini", "Grok"];
    return `=== COVERAGE ${i + 1} — ${names[i] || "AI " + (i + 1)} ===\n\n${c}`;
  }).join("\n\n" + "=".repeat(60) + "\n\n");

  const systemPrompt = `You are a senior development executive analyzing multiple screenplay coverage reports on the same script. Your job is to identify patterns, agreements, and disagreements across the coverages and produce a clear consensus analysis.

CRITICAL INSTRUCTIONS:
- Do NOT use markdown formatting of any kind
- Do not use # headers, ** bold, * italic, --- dividers, or backticks
- Use plain text only
- Write in full, detailed paragraphs
- This document should be at least 8-10 pages of thorough analysis
- Every section must be fully developed with specific examples from the coverages
- Do not include a title, header, or any line that begins with "CONSENSUS ANALYSIS" at the start of your response. Begin directly with the OVERALL CONSENSUS RATING section.

FORMAT YOUR RESPONSE EXACTLY AS FOLLOWS:

CONSENSUS ANALYSIS — [SCRIPT TITLE]

OVERALL CONSENSUS RATING
[State the most common overall rating across all coverages — RECOMMEND, CONSIDER, or PASS — and note if there is disagreement. Write at least 2-3 paragraphs explaining what the consensus rating means for this script.]

WHERE ALL READERS AGREE
[List and fully explain the specific notes, strengths, and weaknesses that appear across ALL coverages. These are your most reliable findings. For each point write at least 2-3 sentences of explanation. Be specific.]

WHERE MOST READERS AGREE
[List notes that appear in the majority but not all coverages. Still highly reliable. Explain each point in detail.]

WHERE READERS DISAGREE
[List areas where the coverages diverge significantly. Explain what each reader thought and why the disagreement itself is useful information for the writer. Write at least a full paragraph per disagreement.]

STRONGEST ASSETS
[The elements ALL readers identified as working well. Protect these in revision. Write detailed explanation of why each asset is valuable.]

PRIORITY REVISIONS — CONSENSUS VIEW
[The revision notes that appear across the most coverages, listed in order of how many readers flagged them. Write at least 2-3 sentences per revision explaining what needs to change and why it matters.]

FINAL CONSENSUS NOTE
[Write at least 3-4 paragraphs synthesizing what the collective read tells this writer about where their script stands and what to do next. Be specific, honest, and constructive.]`;

  const userPrompt = `Please analyze the following ${coverages.length} independent AI coverages of "${scriptTitle}" and produce a thorough consensus analysis. Do NOT use any markdown formatting — plain text only. Write at least 8-10 pages of detailed analysis.\n\n${coverageText}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  });

  return stripMarkdown(message.content[0].text);
}

module.exports = { generateConsensus };
