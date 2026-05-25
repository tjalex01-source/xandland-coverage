const { Resend } = require("resend");

async function sendCoverageEmail(toEmail, scriptTitle, fileBuffer, tier) {
  if (!toEmail) return;

  const resend = new Resend(process.env.RESEND_API_KEY);

  const fileBase64 = fileBuffer.toString("base64");

  const tierNames = {
    1: "Single Coverage",
    2: "Triple Coverage",
    3: "Ultimate Quad Coverage Membership"
  };

  const tierName = tierNames[tier] || "Coverage";
  const isZip = tier > 1;

  const filename = isZip
    ? `Xandland_${tier === 3 ? "Quad" : "Triple"}_Coverage_${scriptTitle.replace(/\s+/g, "_")}.zip`
    : `Xandland_Coverage_${scriptTitle.replace(/\s+/g, "_")}.pdf`;

  const mimeType = isZip ? "application/zip" : "application/pdf";

  const { data, error } = await resend.emails.send({
    from: "Xandland Coverage Service <coverage@xandland.com>",
    to: toEmail,
    subject: `Your ${tierName} — ${scriptTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #050505; color: #ffffff;">

        <div style="background: #1F3864; padding: 30px 40px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 4px;">XANDLAND</h1>
          <p style="color: #aaaaaa; margin: 8px 0 0 0; font-size: 12px; letter-spacing: 2px;">COVERAGE SERVICE</p>
        </div>

        <div style="padding: 40px; background: #0e0e0e;">
          <h2 style="color: #ffffff; font-size: 20px; margin-bottom: 16px;">Your coverage is ready.</h2>
          <p style="color: #888888; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
            Thank you for submitting <strong style="color:#ffffff">${scriptTitle}</strong> to Xandland Coverage Service.
            Your <strong style="color:#ffffff">${tierName}</strong> is attached to this email.
          </p>
          ${isZip ? `
          <p style="color: #888888; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
            The attached ZIP file contains ${tier === 3 ? "4 independent AI coverages" : "3 independent AI coverages"}
            plus a consensus analysis showing where all readers agreed. Extract the ZIP to access all your PDFs.
          </p>
          ` : `
          <p style="color: #888888; font-size: 15px; line-height: 1.7; margin-bottom: 16px;">
            The attached PDF contains your full coverage including logline, ratings, analytical overview,
            scene-by-scene notes, character and dialogue analysis, and a priority revision checklist.
          </p>
          `}
          <p style="color: #888888; font-size: 15px; line-height: 1.7;">
            We hope the notes are helpful as you develop your script. Good luck with your next draft.
          </p>
        </div>

        <div style="padding: 30px 40px; background: #080f1a; border-top: 1px solid #1e1e1e;">
          <p style="color: #555555; font-size: 13px; line-height: 1.7; margin-bottom: 16px;">
            After revisions, consider resubmitting for a fresh read to see how much your script has improved.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://xandland.com/coverage"
               style="background: #2E5D8E; color: white; padding: 12px 28px;
                      text-decoration: none; border-radius: 6px; font-weight: bold;
                      font-size: 14px; letter-spacing: 1px;">
              Submit Another Script
            </a>
          </div>
        </div>

        <div style="background: #1F3864; padding: 20px 40px; text-align: center;">
          <p style="color: #555555; font-size: 11px; margin: 0; line-height: 1.6;">
            © 2026 Xandland Coverage Service · xandland.com<br>
            You received this email because you submitted a screenplay for coverage.
          </p>
          <p style="margin-top: 8px;">
            <a href="https://xandland.com/terms" style="color: #2E5D8E; font-size: 11px; text-decoration: none;">Terms</a>
            &nbsp;·&nbsp;
            <a href="https://xandland.com/privacy-policy" style="color: #2E5D8E; font-size: 11px; text-decoration: none;">Privacy</a>
          </p>
        </div>

      </div>
    `,
    attachments: [
      {
        filename: filename,
        content: fileBase64,
        type: mimeType
      }
    ]
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

module.exports = { sendCoverageEmail };
