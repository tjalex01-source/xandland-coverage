const PDFDocument = require("pdfkit");

function generateCoveragePDF(coverageText, scriptTitle) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        margin: 72,
        size: "LETTER",
        info: {
          Title: `Screenreads Coverage — ${scriptTitle}`,
          Author: "Screenreads.com",
        }
      });

      const buffers = [];
      doc.on("data", chunk => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      // ── COLORS ──
      const DARK_BLUE = "#1F3864";
      const MID_BLUE = "#2E5D8E";
      const WHITE = "#FFFFFF";
      const LIGHT_GRAY = "#F5F5F5";
      const DARK_GRAY = "#333333";
      const GREEN = "#1F6B2E";
      const RED = "#C0392B";

      // ── HEADER ──
      doc.rect(0, 0, doc.page.width, 80).fill(DARK_BLUE);
      doc.fontSize(22).fillColor(WHITE).font("Helvetica-Bold")
        .text("SCREENREADS", 72, 20, { align: "left" });
      doc.fontSize(10).fillColor(WHITE).font("Helvetica")
        .text("Professional Screenplay Coverage", 72, 46, { align: "left" });
      doc.fontSize(10).fillColor(WHITE).font("Helvetica")
        .text("screenreads.com", 0, 46, { align: "right" });

      doc.moveDown(3);

      // ── TITLE BLOCK ──
      doc.rect(72, 95, doc.page.width - 144, 50).fill(MID_BLUE);
      doc.fontSize(16).fillColor(WHITE).font("Helvetica-Bold")
        .text(`COVERAGE REPORT — ${scriptTitle.toUpperCase()}`, 72, 108, {
          width: doc.page.width - 144,
          align: "center"
        });

      doc.y = 160;
      doc.fillColor(DARK_GRAY);

      // ── PARSE AND RENDER COVERAGE ──
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

        const textHeight = doc.heightOfString(blockText.trim(), {
          width: doc.page.width - 200,
          font: "Helvetica",
          size: 10
        });
        const blockHeight = textHeight + 20;

        if (doc.y + blockHeight > doc.page.height - 72) {
          doc.addPage();
        }

        const startY = doc.y;

        // Label column
        doc.rect(72, startY, 60, blockHeight).fill(bgColor);
        doc.fontSize(8).fillColor(labelColor).font("Helvetica-Bold")
          .text(label, 72, startY + 8, { width: 60, align: "center" });

        // Content column
        doc.rect(132, startY, doc.page.width - 204, blockHeight).fill(LIGHT_GRAY);
        doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica")
          .text(blockText.trim(), 140, startY + 8, {
            width: doc.page.width - 220,
          });

        doc.y = startY + blockHeight + 6;
        doc.fillColor(DARK_GRAY);
        blockText = "";
        blockType = "";
        inIssueBlock = false;
        inSuggestBlock = false;
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip empty lines inside blocks — accumulate them
        if (inIssueBlock || inSuggestBlock) {
          if (trimmed.toUpperCase().startsWith("ISSUE:") ||
              trimmed.toUpperCase().startsWith("SUGGESTION:")) {
            flushBlock();
          } else if (trimmed === "" && i + 1 < lines.length) {
            const nextTrimmed = lines[i + 1].trim().toUpperCase();
            if (nextTrimmed.startsWith("ISSUE:") ||
                nextTrimmed.startsWith("SUGGESTION:") ||
                nextTrimmed.startsWith("SCENE:") ||
                nextTrimmed.startsWith("CHARACTER NOTES") ||
                nextTrimmed.startsWith("DIALOGUE NOTES") ||
                nextTrimmed.startsWith("SUMMARY") ||
                nextTrimmed.startsWith("OVERALL RECOMMENDATION")) {
              flushBlock();
              continue;
            } else {
              blockText += " ";
              continue;
            }
          } else {
            blockText += (blockText ? " " : "") + trimmed;
            continue;
          }
        }

        // Detect ISSUE / SUGGESTION blocks
        if (trimmed.toUpperCase().startsWith("ISSUE:")) {
          inIssueBlock = true;
          blockType = "ISSUE";
          blockText = trimmed.substring(6).trim();
          continue;
        }

        if (trimmed.toUpperCase().startsWith("SUGGESTION:")) {
          inSuggestBlock = true;
          blockType = "SUGGESTION";
          blockText = trimmed.substring(11).trim();
          continue;
        }

        // Skip blank lines
        if (trimmed === "") {
          if (doc.y > 160) doc.moveDown(0.5);
          continue;
        }

        // Detect section headers
        const upperTrimmed = trimmed.toUpperCase();
        const isSectionHeader =
          upperTrimmed === "LOGLINE" ||
          upperTrimmed === "RATINGS" ||
          upperTrimmed === "OVERVIEW" ||
          upperTrimmed.startsWith("ACT ONE") ||
          upperTrimmed.startsWith("ACT TWO") ||
          upperTrimmed.startsWith("ACT THREE") ||
          upperTrimmed === "CHARACTER NOTES" ||
          upperTrimmed === "DIALOGUE NOTES" ||
          upperTrimmed.startsWith("SUMMARY") ||
          upperTrimmed.startsWith("SCENE-BY-SCENE");

        if (isSectionHeader) {
          if (doc.y > 160) doc.moveDown(0.5);
          if (doc.y + 30 > doc.page.height - 72) doc.addPage();

          doc.rect(72, doc.y, doc.page.width - 144, 24).fill(MID_BLUE);
          doc.fontSize(11).fillColor(WHITE).font("Helvetica-Bold")
            .text(trimmed.toUpperCase(), 80, doc.y - 20, {
              width: doc.page.width - 160
            });
          doc.y += 10;
          doc.moveDown(0.5);
          doc.fillColor(DARK_GRAY);
          continue;
        }

        // Detect OVERALL RECOMMENDATION line
        if (upperTrimmed.startsWith("OVERALL RECOMMENDATION:")) {
          flushBlock();
          if (doc.y + 50 > doc.page.height - 72) doc.addPage();
          doc.moveDown(1);
          doc.rect(72, doc.y, doc.page.width - 144, 40).fill(DARK_BLUE);
          doc.fontSize(13).fillColor(WHITE).font("Helvetica-Bold")
            .text(trimmed.toUpperCase(), 72, doc.y - 26, {
              width: doc.page.width - 144,
              align: "center"
            });
          doc.y += 20;
          doc.moveDown(1);
          doc.fillColor(DARK_GRAY);
          continue;
        }

        // Detect ratings lines
        const ratingKeywords = ["Premise:", "Story/Structure:", "Character:",
          "Dialogue:", "Marketability:", "Overall:"];
        const isRatingLine = ratingKeywords.some(k => trimmed.startsWith(k));

        if (isRatingLine) {
          if (doc.y + 22 > doc.page.height - 72) doc.addPage();

          const parts = trimmed.split(":");
          const ratingLabel = parts[0].trim();
          const ratingValue = parts.slice(1).join(":").trim();

          const ratingColor =
            ratingValue === "RECOMMEND" ? GREEN :
            ratingValue === "CONSIDER" ? "#E67E22" : RED;

          const rowBg = doc.y % 44 < 22 ? LIGHT_GRAY : WHITE;
          doc.rect(72, doc.y, doc.page.width - 144, 22).fill(rowBg);

          doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica-Bold")
            .text(ratingLabel, 80, doc.y - 14, { width: 200 });

          doc.fontSize(10).fillColor(ratingColor).font("Helvetica-Bold")
            .text(ratingValue, 280, doc.y - 14, { width: 150 });

          doc.y += 8;
          doc.fillColor(DARK_GRAY);
          continue;
        }

        // Detect scene headers
        if (upperTrimmed.startsWith("SCENE:")) {
          if (doc.y + 24 > doc.page.height - 72) doc.addPage();
          doc.moveDown(0.5);
          doc.fontSize(11).fillColor(MID_BLUE).font("Helvetica-Bold")
            .text(trimmed, { width: doc.page.width - 144 });
          doc.moveDown(0.3);
          doc.fillColor(DARK_GRAY);
          continue;
        }

        // Detect bullet points
        if (trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          if (doc.y + 16 > doc.page.height - 72) doc.addPage();
          doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica")
            .text("•  " + trimmed.substring(2), 80, doc.y, {
              width: doc.page.width - 160,
              indent: 0
            });
          doc.moveDown(0.3);
          continue;
        }

        // Detect bold markdown **text**
        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          if (doc.y + 16 > doc.page.height - 72) doc.addPage();
          doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica-Bold")
            .text(trimmed.replace(/\*\*/g, ""), { width: doc.page.width - 144 });
          doc.moveDown(0.3);
          continue;
        }

        // Regular body text
        if (doc.y + 16 > doc.page.height - 72) doc.addPage();
        doc.fontSize(10).fillColor(DARK_GRAY).font("Helvetica")
          .text(trimmed, { width: doc.page.width - 144, align: "justify" });
        doc.moveDown(0.4);
      }

      // Flush any remaining block
      flushBlock();

      // ── FOOTER ON EACH PAGE ──
      const pageCount = doc.bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.rect(0, doc.page.height - 40, doc.page.width, 40).fill(DARK_BLUE);
        doc.fontSize(8).fillColor(WHITE).font("Helvetica")
          .text(
            `Screenreads.com  |  Professional AI Screenplay Coverage  |  Page ${i + 1} of ${pageCount}`,
            72,
            doc.page.height - 26,
            { align: "center", width: doc.page.width - 144 }
          );
      }

      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCoveragePDF };
