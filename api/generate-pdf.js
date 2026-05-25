const PDFDocument = require("pdfkit");

function generateCoveragePDF(coverageText, scriptTitle, modelName) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 72,
        size: "LETTER",
        bufferPages: true,
        info: {
          Title: `Xandland Coverage — ${scriptTitle}`,
          Author: "Xandland Coverage Service",
        }
      });

      const buffers = [];
      doc.on("data", chunk => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const DARK_BLUE = "#1F3864";
      const MID_BLUE = "#2E5D8E";
      const WHITE = "#FFFFFF";
      const LIGHT_GRAY = "#F5F5F5";
      const DARK_GRAY = "#333333";
      const GREEN = "#1F6B2E";
      const RED = "#C0392B";
      const PURPLE = "#6C3483";

      const modelColors = {
        "Claude": "#E8892B",
        "ChatGPT": "#10A37F",
        "Gemini": "#4285F4",
        "Grok": "#1DA1F2",
        "Consensus Analysis": "#6C3483"
      };

      const modelColor = modelColors[modelName] || MID_BLUE;

      // ── HEADER ──
      doc.rect(0, 0, doc.page.width, 80).fill(DARK_BLUE);
      doc.fontSize(22).fillColor(WHITE).font("Helvetica-Bold")
        .text("XANDLAND COVERAGE SERVICE", 72, 18, { align: "left" });
      doc.fontSize(10).fillColor(WHITE).font("Helvetica")
        .text("xandland.com", 0, 18, { align: "right" });

      if (modelName) {
        doc.rect(0, 56, doc.page.width, 24).fill(modelColor);
        doc.fontSize(10).fillColor(WHITE).font("Helvetica-Bold")
          .text(
            modelName === "Consensus Analysis"
              ? "CONSENSUS ANALYSIS — ALL READERS"
              : `READER: ${modelName.toUpperCase()}`,
            72, 62,
            { width: doc.page.width - 144 }
          );
      }

      // ── TITLE BLOCK ──
      doc.rect(72, 95, doc.page.width - 144, 50).fill(MID_BLUE);
      doc.fontSize(14).fillColor(WHITE).font("Helvetica-Bold")
        .text(
          modelName === "Consensus Analysis"
            ? `CONSENSUS ANALYSIS — ${scriptTitle.toUpperCase()}`
            : `COVERAGE REPORT — ${scriptTitle.toUpperCase()}`,
          72, 108,
          { width: doc.page.width - 144, align: "center" }
        );

      doc.y = 165;
      doc.fillColor(DARK_GRAY);

      const ensureSpace = (height) => {
        if (doc.y + height > doc.page.height - 80) {
          doc.addPage();
          doc.y = 72;
          doc.fillColor(DARK_GRAY);
        }
      };

      const lines = coverageText.split("\n");
      let inIssueBlock = false;
      let inSuggestBlock = false;
      let blockText = "";
      let blockType = "";

      const flushBlock = () => {
        if (!blockText.trim()) return;

        const isIssue = blockType === "ISSUE";
        const bgColor = isIssue ? "#FFF3E0" : "#E8F5E9";
        const labelColor = isIssue ? RED : GREEN;
        const label = isIssue ? "ISSUE" : "SUGGESTION";

        const textHeight = doc.heightOfString(blockText.trim(), { width: doc.page.width - 224 });
        const blockHeight = Math.max(textHeight + 20, 36);

        ensureSpace(blockHeight + 10);

        const startY = doc.y;
        doc.rect(72, startY, 60, blockHeight).fill(bgColor);
        doc.fontSize(8).fillColor(labelColor).font("Helvetica-Bold")
          .text(label, 72, startY + 10, { width: 60, align: "center" });
        doc.rect(132, startY, doc.page.width - 204, blockHeight).fill(LIGHT_GRAY);
        doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica")
          .text(blockText.trim(), 140, startY + 10, { width: doc.page.width - 224 });

        doc.y = startY + blockHeight + 8;
        doc.fillColor(DARK_GRAY);
        blockText = "";
        blockType = "";
        inIssueBlock = false;
        inSuggestBlock = false;
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (inIssueBlock || inSuggestBlock) {
          const upperTrimmed = trimmed.toUpperCase();
          const isNewBlock = upperTrimmed.startsWith("ISSUE:") || upperTrimmed.startsWith("SUGGESTION:");
          const isNewSection =
            upperTrimmed === "LOGLINE" || upperTrimmed === "RATINGS" ||
            upperTrimmed === "OVERVIEW" || upperTrimmed.startsWith("ACT ONE") ||
            upperTrimmed.startsWith("ACT TWO") || upperTrimmed.startsWith("ACT THREE") ||
            upperTrimmed === "CHARACTER NOTES" || upperTrimmed === "DIALOGUE NOTES" ||
            upperTrimmed.startsWith("SUMMARY") || upperTrimmed.startsWith("SCENE-BY-SCENE") ||
            upperTrimmed.startsWith("OVERALL RECOMMENDATION") || upperTrimmed.startsWith("SCENE:") ||
            upperTrimmed.startsWith("WHERE ALL") || upperTrimmed.startsWith("WHERE MOST") ||
            upperTrimmed.startsWith("WHERE READERS") || upperTrimmed.startsWith("STRONGEST") ||
            upperTrimmed.startsWith("PRIORITY") || upperTrimmed.startsWith("FINAL CONSENSUS") ||
            upperTrimmed.startsWith("OVERALL CONSENSUS");

          if (isNewBlock || isNewSection) {
            flushBlock();
          } else {
            if (trimmed !== "") blockText += (blockText ? " " : "") + trimmed;
            continue;
          }
        }

        if (trimmed === "") continue;

        const upperTrimmed = trimmed.toUpperCase();

        if (upperTrimmed.startsWith("ISSUE:")) {
          inIssueBlock = true; inSuggestBlock = false;
          blockType = "ISSUE";
          blockText = trimmed.substring(6).trim();
          continue;
        }

        if (upperTrimmed.startsWith("SUGGESTION:")) {
          inSuggestBlock = true; inIssueBlock = false;
          blockType = "SUGGESTION";
          blockText = trimmed.substring(11).trim();
          continue;
        }

        const isSectionHeader =
          upperTrimmed === "LOGLINE" || upperTrimmed === "RATINGS" ||
          upperTrimmed === "OVERVIEW" || upperTrimmed.startsWith("ACT ONE") ||
          upperTrimmed.startsWith("ACT TWO") || upperTrimmed.startsWith("ACT THREE") ||
          upperTrimmed === "CHARACTER NOTES" || upperTrimmed === "DIALOGUE NOTES" ||
          upperTrimmed.startsWith("SUMMARY") || upperTrimmed.startsWith("SCENE-BY-SCENE") ||
          upperTrimmed.startsWith("WHERE ALL") || upperTrimmed.startsWith("WHERE MOST") ||
          upperTrimmed.startsWith("WHERE READERS") || upperTrimmed.startsWith("STRONGEST") ||
          upperTrimmed.startsWith("PRIORITY REVISIONS") || upperTrimmed.startsWith("FINAL CONSENSUS") ||
          upperTrimmed.startsWith("OVERALL CONSENSUS");

        if (isSectionHeader) {
          ensureSpace(34);
          doc.moveDown(0.3);
          const headerY = doc.y;
          doc.rect(72, headerY, doc.page.width - 144, 24).fill(MID_BLUE);
          doc.fontSize(11).fillColor(WHITE).font("Helvetica-Bold")
            .text(trimmed.toUpperCase(), 80, headerY + 6, { width: doc.page.width - 160 });
          doc.y = headerY + 32;
          doc.fillColor(DARK_GRAY);
          continue;
        }

        if (upperTrimmed.startsWith("OVERALL RECOMMENDATION:") || upperTrimmed.startsWith("OVERALL CONSENSUS RATING")) {
          flushBlock();
          ensureSpace(50);
          doc.moveDown(0.5);
          const recY = doc.y;
          doc.rect(72, recY, doc.page.width - 144, 40).fill(DARK_BLUE);
          doc.fontSize(13).fillColor(WHITE).font("Helvetica-Bold")
            .text(trimmed.toUpperCase(), 80, recY + 12, { width: doc.page.width - 160, align: "center" });
          doc.y = recY + 48;
          doc.fillColor(DARK_GRAY);
          continue;
        }

        const ratingKeywords = ["Premise:", "Story/Structure:", "Character:", "Dialogue:", "Marketability:", "Overall:"];
        const isRatingLine = ratingKeywords.some(k => trimmed.startsWith(k));

        if (isRatingLine) {
          ensureSpace(24);
          const parts = trimmed.split(":");
          const ratingLabel = parts[0].trim();
          const ratingValue = parts.slice(1).join(":").trim();
          const ratingColor = ratingValue === "RECOMMEND" ? GREEN : ratingValue === "CONSIDER" ? "#E67E22" : RED;
          const rowY = doc.y;
          doc.rect(72, rowY, doc.page.width - 144, 22).fill(LIGHT_GRAY);
          doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica-Bold").text(ratingLabel, 80, rowY + 5, { width: 200 });
          doc.fontSize(10).fillColor(ratingColor).font("Helvetica-Bold").text(ratingValue, 300, rowY + 5, { width: 150 });
          doc.y = rowY + 24;
          doc.fillColor(DARK_GRAY);
          continue;
        }

        if (upperTrimmed.startsWith("SCENE:")) {
          ensureSpace(30);
          doc.moveDown(0.4);
          doc.fontSize(11).fillColor(MID_BLUE).font("Helvetica-Bold")
            .text(trimmed, 72, doc.y, { width: doc.page.width - 144 });
          doc.moveDown(0.4);
          doc.fillColor(DARK_GRAY);
          continue;
        }

        if (trimmed.startsWith("- ") || trimmed.startsWith("• ") || trimmed.startsWith("* ")) {
          const bulletText = trimmed.substring(2);
          const bulletHeight = doc.heightOfString(bulletText, { width: doc.page.width - 164 });
          ensureSpace(bulletHeight + 8);
          doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica")
            .text("•  " + bulletText, 82, doc.y, { width: doc.page.width - 164 });
          doc.moveDown(0.3);
          continue;
        }

        const cleanText = trimmed.replace(/\*\*/g, "");
        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          ensureSpace(20);
          doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica-Bold")
            .text(cleanText, 72, doc.y, { width: doc.page.width - 144 });
          doc.moveDown(0.3);
          continue;
        }

        const textHeight = doc.heightOfString(cleanText, { width: doc.page.width - 144 });
        ensureSpace(textHeight + 8);
        doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica")
          .text(cleanText, 72, doc.y, { width: doc.page.width - 144, align: "justify" });
        doc.moveDown(0.4);
      }

      flushBlock();

      const range = doc.bufferedPageRange();
      const totalPages = range.count;

      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(range.start + i);
        doc.rect(0, doc.page.height - 36, doc.page.width, 36).fill(DARK_BLUE);
        doc.fontSize(8).fillColor(WHITE).font("Helvetica")
          .text(
            `Xandland Coverage Service  |  ${modelName ? modelName + "  |  " : ""}Page ${i + 1} of ${totalPages}`,
            72,
            doc.page.height - 22,
            { align: "center", width: doc.page.width - 144 }
          );
      }

      doc.flushPages();
      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCoveragePDF };
