const { generateCoveragePDF } = require("./generate-pdf");
const { generateConsensus } = require("./consensus");
const { generateZip } = require("./generate-zip");
const { sendCoverageEmail } = require("./send-email");

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

    const { coverageTexts, scriptTitle, tier, emailAddress, sessionId, customerName } = JSON.parse(body);

    if (!coverageTexts || coverageTexts.length === 0) {
      return res.status(400).json({ error: "No coverage texts provided" });
    }

    const title  = scriptTitle || "Untitled Script";
    const tierNum = parseInt(tier) || 1;
    const modelNames = ["Claude", "ChatGPT", "Gemini", "Grok"];

    let outputBuffer;
    let filename;
    let contentType;

    if (tierNum === 1) {
      // Single coverage — just generate the PDF
      outputBuffer = await generateCoveragePDF(coverageTexts[0], title, "Claude");
      filename     = `Xandland_Coverage_${title.replace(/\s+/g, "_")}.pdf`;
      contentType  = "application/pdf";

    } else {
      // Multi-model — generate consensus and ZIP
      const consensus  = await generateConsensus(coverageTexts, title);
      outputBuffer = await generateZip(coverageTexts, consensus, title);
      filename     = tier === 3
        ? `Xandland_Quad_Coverage_${title.replace(/\s+/g, "_")}.zip`
        : `Xandland_Triple_Coverage_${title.replace(/\s+/g, "_")}.zip`;
      contentType  = "application/zip";
    }

    // ── EMAIL ──
    let emailTo = emailAddress;

    if (!emailTo && sessionId) {
      try {
        const stripe  = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        emailTo = session.customer_details?.email || "";
      } catch (stripeErr) {
        console.error("Stripe email lookup failed:", stripeErr.message);
      }
    }

if (emailTo) {
      // Send coverage email
      try {
        await sendCoverageEmail(emailTo, title, outputBuffer, tierNum);
      } catch (emailErr) {
        console.error("Email failed:", emailErr.message);
      }

      // Save contact to Resend audience
      try {
        const nameParts = (customerName || "").split(" ");
        const firstName = nameParts[0] || "";
        const lastName  = nameParts.slice(1).join(" ") || "";

        await fetch("https://api.resend.com/contacts", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + process.env.RESEND_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email:      emailTo,
            first_name: firstName,
            last_name:  lastName,
            unsubscribed: false
          })
        });

        console.log("Contact saved to Resend:", emailTo);
      } catch (contactErr) {
        console.error("Resend contact save failed:", contactErr.message);
      }
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", outputBuffer.length);
    return res.end(outputBuffer);

  } catch (error) {
    console.error("Assemble error:", error);
    return res.status(500).json({
      error:   "Failed to assemble coverage",
      details: error.message
    });
  }
};
