const JSZip = require("jszip");
const { generateCoveragePDF } = require("./generate-pdf");

async function generateZip(coverages, consensusText, scriptTitle) {
  const zip = new JSZip();
  const folder = zip.folder(`Xandland_Coverage_${scriptTitle.replace(/\s+/g, "_")}`);
  const modelNames = ["Claude", "ChatGPT", "Gemini", "Grok"];

  for (let i = 0; i < coverages.length; i++) {
    const modelName = modelNames[i] || `AI_${i + 1}`;
    const pdfBuffer = await generateCoveragePDF(
      coverages[i],
      scriptTitle,
      modelName
    );
    folder.file(
      `Coverage_${i + 1}_${modelName}_${scriptTitle.replace(/\s+/g, "_")}.pdf`,
      pdfBuffer
    );
  }

  if (consensusText) {
    const consensusPdf = await generateCoveragePDF(
      consensusText,
      scriptTitle,
      "Consensus Analysis"
    );
    folder.file(
      `Consensus_Analysis_${scriptTitle.replace(/\s+/g, "_")}.pdf`,
      consensusPdf
    );
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return zipBuffer;
}

module.exports = { generateZip };
