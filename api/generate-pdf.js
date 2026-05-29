const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

function generateCoveragePDF(coverageText, scriptTitle, modelName) {
  return new Promise((resolve, reject) => {
    try {
      const BLACK      = "#000000";
      const MID_BLUE   = "#2E5D8E";
      const WHITE      = "#FFFFFF";
      const LIGHT_GRAY = "#F5F5F5";
      const DARK_GRAY  = "#333333";
      const GREEN      = "#1F6B2E";
      const RED        = "#C0392B";

      const modelColors = {
        "Claude":             "#E8892B",
        "ChatGPT":            "#10A37F",
        "Gemini":             "#4285F4",
        "Grok":               "#1DA1F2",
        "Consensus Analysis": "#6C3483"
      };

      const modelColor = modelColors[modelName] || MID_BLUE;
      const MARGIN      = 72;
      const PAGE_BOTTOM = 720;

      const FONT_REGULAR = path.join(__dirname, "fonts", "Roboto-Regular.ttf");
      const FONT_BOLD    = path.join(__dirname, "fonts", "Roboto-Bold.ttf");

      const doc = new PDFDocument({
        margin: MARGIN,
        size: "LETTER",
        bufferPages: false,
        info: {
          Title:  `Xandland Coverage — ${scriptTitle}`,
          Author: "Xandland Coverage Service",
        }
      });

      doc.registerFont("Roboto", FONT_REGULAR);
      doc.registerFont("Roboto-Bold", FONT_BOLD);

      const buffers = [];
      doc.on("data",  chunk => buffers.push(chunk));
      doc.on("end",   ()    => resolve(Buffer.concat(buffers)));
      doc.on("error", reject);

      const ensureSpace = (height) => {
        if (doc.y + height > PAGE_BOTTOM) {
          doc.addPage();
          doc.y = MARGIN;
          doc.fillColor(DARK_GRAY);
        }
      };

      // ── HEADER — black background with logo ──
      const HEADER_HEIGHT = 70;
      doc.rect(0, 0, doc.page.width, HEADER_HEIGHT).fill(BLACK);

      const logoPath = path.join(__dirname, "..", "xandland-logo.png");
      if (fs.existsSync(logoPath)) {
        try {
          const logoHeight = HEADER_HEIGHT - 10;
          const logoWidth  = logoHeight * (2000 / 1125);
          doc.image(logoPath, 8, 5, {
            width:  logoWidth,
            height: logoHeight
          });
          const textX = 8 + logoWidth + 10;
          doc.fontSize(14).fillColor(WHITE).font("Roboto-Bold")
            .text("XANDLAND COVERAGE SERVICE", textX, 20, {
              width: doc.page.width - textX - 10
            });
          doc.fontSize(9).fillColor("#aaaaaa").font("Roboto")
            .text("xandland.com", textX, 40, {
              width: doc.page.width - textX - 10
            });
        } catch (logoErr) {
          console.log("Logo embed failed, using text header:", logoErr.message);
          doc.fontSize(18).fillColor(WHITE).font("Roboto-Bold")
            .text("XANDLAND COVERAGE SERVICE", MARGIN, 20, { align: "left" });
          doc.fontSize(9).fillColor("#aaaaaa").font("Roboto")
            .text("xandland.com", 0, 20, { align: "right" });
        }
      } else {
        doc.fontSize(18).fillColor(WHITE).font("Roboto-Bold")
          .text("XANDLAND COVERAGE SERVICE", MARGIN, 20, { align: "left" });
        doc.fontSize(9).fillColor("#aaaaaa").font("Roboto")
          .text("xandland.com", 0, 20, { align: "right" });
      }

      // ── MODEL COLOR BAR ──
      if (modelName) {
        doc.rect(0, HEADER_HEIGHT, doc.page.width, 22).fill(modelColor);
        doc.fontSize(9).fillColor(WHITE).font("Roboto-Bold")
          .text(
            modelName === "Consensus Analysis"
              ? "CONSENSUS ANALYSIS — ALL READERS"
              : `READER: ${modelName.toUpperCase()}`,
            MARGIN, HEADER_HEIGHT + 6,
            { width: doc.page.width - MARGIN * 2 }
          );
      }

      // ── TITLE BLOCK ──
      const titleY = HEADER_HEIGHT + (modelName ? 22 : 0);
      doc.rect(MARGIN, titleY + 4, doc.page.width - MARGIN * 2, 44).fill(MID_BLUE);
      doc.fontSize(13).fillColor(WHITE).font("Roboto-Bold")
        .text(
          modelName === "Consensus Analysis"
            ? `CONSENSUS ANALYSIS — ${scriptTitle.toUpperCase()}`
            : `COVERAGE REPORT — ${scriptTitle.toUpperCase()}`,
          MARGIN, titleY + 14,
          { width: doc.page.width - MARGIN * 2, align: "center" }
        );

      doc.y = titleY + 56;
      doc.fillColor(DARK_GRAY);

      // ── CONTENT PARSER ──
      const lines = coverageText.split("\n");
      let inIssueBlock   = false;
      let inSuggestBlock = false;
      let blockText      = "";
      let blockType      = "";

      const flushBlock = () => {
        if (!blockText.trim()) return;

        const isIssue    = blockType === "ISSUE";
        const bgColor    = isIssue ? "#FFF3E0" : "#E8F5E9";
        const labelColor = isIssue ? RED : GREEN;
        const label      = isIssue ? "ISSUE" : "SUGGESTION";

        const textHeight  = doc.heightOfString(blockText.trim(), { width: doc.page.width - 224 });
        const blockHeight = Math.max(textHeight + 20, 36);

        ensureSpace(blockHeight + 10);

        const startY = doc.y;
        doc.rect(72, startY, 60, blockHeight).fill(bgColor);
        doc.fontSize(8).fillColor(labelColor).font("Roboto-Bold")
          .text(label, 72, startY + 10, { width: 60, align: "center" });
        doc.rect(132, startY, doc.page.width - 204, blockHeight).fill(LIGHT_GRAY);
        doc.fontSize(10).fillColor(DARK_GRAY).font("Roboto")
          .text(blockText.trim(), 140, startY + 10, { width: doc.page.width - 224 });

        doc.y = startY + blockHeight + 8;
        doc.fillColor(DARK_GRAY);
        blockText      = "";
        blockType      = "";
        inIssueBlock   = false;
        inSuggestBlock = false;
      };

      for (let i = 0; i < lines.length; i++) {
        const line    = lines[i];
        const trimmed = line.trim();

        if (inIssueBlock || inSuggestBlock) {
          const upperTrimmed = trimmed.toUpperCase();
          const isNewBlock =
            upperTrimmed.startsWith("ISSUE:") ||
            upperTrimmed.startsWith("SUGGESTION:");
          const isSectionHeader =
            upperTrimmed === "LOGLINE" ||
            upperTrimmed === "RATINGS" ||
            upperTrimmed === "OVERVIEW" ||
            upperTrimmed === "CHARACTER NOTES" ||
            upperTrimmed === "DIALOGUE NOTES" ||
            upperTrimmed === "STRUCTURE NOTES" ||
            upperTrimmed === "GENRE EXECUTION" ||
            upperTrimmed === "MARKET POSITIONING" ||
            upperTrimmed.startsWith("ACT ONE") ||
            upperTrimmed.startsWith("ACT TWO") ||
            upperTrimmed.startsWith("ACT THREE") ||
            upperTrimmed.startsWith("SUMMARY") ||
            upperTrimmed.startsWith("SCENE-BY-SCENE") ||
            upperTrimmed.startsWith("WHERE ALL") ||
            upperTrimmed.startsWith("WHERE MOST") ||
            upperTrimmed.startsWith("WHERE READERS") ||
            upperTrimmed.startsWith("STRONGEST") ||
            upperTrimmed.startsWith("PRIORITY REVISIONS") ||
            upperTrimmed.startsWith("FINAL CONSENSUS") ||
            upperTrimmed.startsWith("OVERALL CONSENSUS");

          if (isNewBlock || isSectionHeader) {
            flushBlock();
          } else {
            if (trimmed !== "") blockText += (blockText ? " " : "") + trimmed;
            continue;
          }
        }

        if (trimmed === "") continue;

        const upperTrimmed = trimmed.toUpperCase();

        if (upperTrimmed.startsWith("ISSUE:")) {
          inIssueBlock   = true;
          inSuggestBlock = false;
          blockType      = "ISSUE";
          blockText      = trimmed.substring(6).trim();
          continue;
        }

        if (upperTrimmed.startsWith("SUGGESTION:")) {
          inSuggestBlock = true;
          inIssueBlock   = false;
          blockType      = "SUGGESTION";
          blockText      = trimmed.substring(11).trim();
          continue;
        }

        const isSectionHeader =
          upperTrimmed === "LOGLINE" ||
          upperTrimmed === "RATINGS" ||
          upperTrimmed === "OVERVIEW" ||
          upperTrimmed === "CHARACTER NOTES" ||
          upperTrimmed === "DIALOGUE NOTES" ||
          upperTrimmed === "STRUCTURE NOTES" ||
          upperTrimmed === "GENRE EXECUTION" ||
          upperTrimmed === "MARKET POSITIONING" ||
          upperTrimmed.startsWith("ACT ONE") ||
          upperTrimmed.startsWith("ACT TWO") ||
          upperTrimmed.startsWith("ACT THREE") ||
          upperTrimmed.startsWith("SUMMARY") ||
          upperTrimmed.startsWith("SCENE-BY-SCENE") ||
          upperTrimmed.startsWith("WHERE ALL") ||
          upperTrimmed.startsWith("WHERE MOST") ||
          upperTrimmed.startsWith("WHERE READERS") ||
          upperTrimmed.startsWith("STRONGEST") ||
          upperTrimmed.startsWith("PRIORITY REVISIONS") ||
          upperTrimmed.startsWith("FINAL CONSENSUS") ||
          upperTrimmed.startsWith("OVERALL CONSENSUS");

        if (isSectionHeader) {
          ensureSpace(34);
          doc.moveDown(0.3);
          const headerY = doc.y;
          doc.rect(72, headerY, doc.page.width - 144, 24).fill(MID_BLUE);
          doc.fontSize(11).fillColor(WHITE).font("Roboto-Bold")
            .text(trimmed.toUpperCase(), 80, headerY + 6, {
              width: doc.page.width - 160
            });
          doc.y = headerY + 32;
          doc.fillColor(DARK_GRAY);
          continue;
        }

        if (
          upperTrimmed.startsWith("OVERALL RECOMMENDATION:") ||
          upperTrimmed.startsWith("OVERALL CONSENSUS RATING")
        ) {
          flushBlock();
          ensureSpace(50);
          doc.moveDown(0.5);
          const recY = doc.y;
          doc.rect(72, recY, doc.page.width - 144, 40).fill(BLACK);
          doc.fontSize(13).fillColor(WHITE).font("Roboto-Bold")
            .text(trimmed.toUpperCase(), 80, recY + 12, {
              width: doc.page.width - 160,
              align: "center"
            });
          doc.y = recY + 48;
          doc.fillColor(DARK_GRAY);
          continue;
        }

        const ratingKeywords = [
          "Premise:", "Story/Structure:", "Character:",
          "Dialogue:", "Marketability:", "Overall:"
        ];
        const isRatingLine = ratingKeywords.some(k => trimmed.startsWith(k));

        if (isRatingLine) {
          ensureSpace(24);
          const parts       = trimmed.split(":");
          const ratingLabel = parts[0].trim();
          const ratingValue = parts.slice(1).join(":").trim();
          const ratingColor =
            ratingValue === "RECOMMEND" ? GREEN :
            ratingValue === "CONSIDER"  ? "#E67E22" : RED;
          const rowY = doc.y;
          doc.rect(72, rowY, doc.page.width - 144, 22).fill(LIGHT_GRAY);
          doc.fontSize(10).fillColor(DARK_GRAY).font("Roboto-Bold")
            .text(ratingLabel, 80, rowY + 5, { width: 200 });
          doc.fontSize(10).fillColor(ratingColor).font("Roboto-Bold")
            .text(ratingValue, 300, rowY + 5, { width: 150 });
          doc.y = rowY + 24;
          doc.fillColor(DARK_GRAY);
          continue;
        }

        if (upperTrimmed.startsWith("SCENE:")) {
          ensureSpace(30);
          doc.moveDown(0.4);
          doc.fontSize(11).fillColor(MID_BLUE).font("Roboto-Bold")
            .text(trimmed, 72, doc.y, { width: doc.page.width - 144 });
          doc.moveDown(0.4);
          doc.fillColor(DARK_GRAY);
          continue;
        }

        if (
          trimmed.startsWith("- ") ||
          trimmed.startsWith("• ") ||
          trimmed.startsWith("* ")
        ) {
          const bulletText   = trimmed.substring(2);
          const bulletHeight = doc.heightOfString(bulletText, {
            width: doc.page.width - 164
          });
          ensureSpace(bulletHeight + 8);
          doc.fontSize(10).fillColor(DARK_GRAY).font("Roboto")
            .text("•  " + bulletText, 82, doc.y, {
              width: doc.page.width - 164
            });
          doc.moveDown(0.3);
          continue;
        }

        const cleanText = trimmed.replace(/\*\*/g, "");

        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          ensureSpace(20);
          doc.fontSize(10).fillColor(DARK_GRAY).font("Roboto-Bold")
            .text(cleanText, 72, doc.y, { width: doc.page.width - 144 });
          doc.moveDown(0.3);
          continue;
        }

        const textHeight = doc.heightOfString(cleanText, {
          width: doc.page.width - 144
        });
        ensureSpace(textHeight + 8);
        doc.fontSize(10).fillColor(DARK_GRAY).font("Roboto")
          .text(cleanText, 72, doc.y, {
            width:  doc.page.width - 144,
            align:  "justify"
          });
        doc.moveDown(0.4);
      }

      flushBlock();
      doc.end();

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateCoveragePDF };
