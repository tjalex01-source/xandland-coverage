const Anthropic = require("@anthropic-ai/sdk");
const OpenAI = require("openai");

const LOGLINE_SYSTEM_PROMPT = `You are a professional Hollywood logline writer with years of experience crafting compelling, marketable loglines for feature films and television.

A great logline:
- Is one to two sentences maximum
- Identifies the protagonist and what makes them compelling
- States the central conflict or goal clearly
- Hints at the stakes
- Captures the tone and genre
- Is specific, not generic
- Does NOT include character names unless they are iconic
- Avoids vague language like "embarks on a journey" or "must find a way"

Your job is to write exactly 4 loglines for the project described. Each logline should take a meaningfully different angle, emphasis, or tone — not just slight variations of the same sentence.

Your entire response must look exactly like this and nothing else:
1. [logline one]
2. [logline two]
3. [logline three]
4. [logline four]

Four lines. Four loglines. Nothing before line 1. Nothing after line 4.`;

function stripNumbering(text) {
  return text
    .split("\n")
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .map(line => line.replace(/^[1234]\.\s*/, "").trim())
    .filter(line => line.length > 0)
    .slice(0, 4);
}

async function getLoglines(projectDescription, model) {
let trimmedDescription = projectDescription;
  if (projectDescription.length > 12000) {
    const third = Math.floor(projectDescription.length / 3);
    const opening = projectDescription.substring(0, 4000);
    const middle = projectDescription.substring(third, third + 4000);
    const ending = projectDescription.substring(projectDescription.length - 4000);
    trimmedDescription = opening +
      "\n\n[... middle section of script ...]\n\n" +
      middle +
      "\n\n[... final section of script ...]\n\n" +
      ending +
      "\n\n[End of script excerpt — write loglines that capture the full story arc from beginning to end]";
  }

  const userPrompt = `Please write 4 loglines for the following project. Each should take a meaningfully different angle. Return only the 4 numbered loglines, nothing else.\n\n${trimmedDescription}`;

  if (model === "claude") {
    const client = new Anthropic.default({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      system: LOGLINE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }]
    });
    return stripNumbering(message.content[0].text);
  }

  if (model === "chatgpt") {
    const client = new OpenAI.default({ apiKey: process.env.OPENAI_API_KEY });
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 600,
          messages: [
            { role: "system", content: LOGLINE_SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ]
        });
        return stripNumbering(response.choices[0].message.content);
      } catch (err) {
        lastError = err;
        if ((err.status === 503 || err.status === 429) && attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 5000));
        } else throw err;
      }
    }
    throw lastError;
  }

  if (model === "grok") {
    const client = new OpenAI.default({
      apiKey: process.env.GROK_API_KEY,
      baseURL: "https://api.x.ai/v1"
    });
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: "grok-4.3",
          max_tokens: 600,
          messages: [
            { role: "system", content: LOGLINE_SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ]
        });
        return stripNumbering(response.choices[0].message.content);
      } catch (err) {
        lastError = err;
        if ((err.status === 503 || err.status === 429) && attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 5000));
        } else throw err;
      }
    }
    throw lastError;
  }

  if (model === "llama") {
    const client = new OpenAI.default({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1"
    });
    let lastError;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: 600,
          messages: [
            { role: "system", content: LOGLINE_SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
          ]
        });
        return stripNumbering(response.choices[0].message.content);
      } catch (err) {
        lastError = err;
        if ((err.status === 503 || err.status === 429) && attempt < 3) {
          await new Promise(r => setTimeout(r, attempt * 5000));
        } else throw err;
      }
    }
    throw lastError;
  }

  throw new Error("Unknown model: " + model);
}

async function sendLoglineEmail(toEmail, projectTitle, loglines) {
  const { Resend } = require("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);

  const modelNames = ["Claude", "ChatGPT", "Grok", "Llama"];
  const modelKeys = ["claude", "chatgpt", "grok", "llama"];

  const allLoglines = modelKeys.map((key, i) => {
    return `${modelNames[i].toUpperCase()}\n${(loglines[key] || []).map((l, j) => `${j + 1}. ${l}`).join("\n")}`;
  }).join("\n\n");

  const htmlSections = modelKeys.map((key, i) => {
    const group = loglines[key] || [];
    const items = group.map((l, j) => `
      <div style="padding: 12px 16px; background: #0e0e0e; border-left: 3px solid #2E5D8E; margin-bottom: 8px; border-radius: 0 6px 6px 0;">
        <span style="color: #555555; font-size: 11px; font-weight: 700; letter-spacing: 1px;">${j + 1}</span>
        <p style="color: #cccccc; font-size: 14px; line-height: 1.7; margin: 4px 0 0 0;">${l}</p>
      </div>
    `).join("");
    return `
      <div style="margin-bottom: 28px;">
        <p style="color: #4a90d9; font-size: 11px; font-weight: 700; letter-spacing: 3px; margin-bottom: 10px;">${modelNames[i].toUpperCase()}</p>
        ${items}
      </div>
    `;
  }).join("");

  await resend.emails.send({
    from: "Xandland Coverage Service <coverage@xandland.com>",
    to: toEmail,
    subject: `Your 16 Loglines — ${projectTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #050505; color: #ffffff;">
        <div style="background: #1F3864; padding: 30px 40px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 22px; letter-spacing: 4px;">XANDLAND</h1>
          <p style="color: #aaaaaa; margin: 8px 0 0 0; font-size: 12px; letter-spacing: 2px;">LOGLINE GENERATOR</p>
        </div>
        <div style="padding: 40px; background: #0e0e0e;">
          <h2 style="color: #ffffff; font-size: 18px; margin-bottom: 8px;">Your 16 loglines are ready.</h2>
          <p style="color: #888888; font-size: 14px; line-height: 1.7; margin-bottom: 28px;">
            Here are 16 loglines for <strong style="color:#ffffff">${projectTitle}</strong> — 4 from each of our 4 independent AI writers, each taking a different angle on your story.
          </p>
          ${htmlSections}
          <p style="color: #555555; font-size: 13px; line-height: 1.7; margin-top: 28px;">
            Mix, match, and combine elements from different loglines to find the version that best captures your story.
          </p>
        </div>
        <div style="background: #1F3864; padding: 20px 40px; text-align: center;">
          <p style="color: #555555; font-size: 11px; margin: 0;">
            © 2026 Xandland Coverage Service · xandland.com
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: `Xandland_Loglines_${projectTitle.replace(/\s+/g, "_")}.txt`,
        content: Buffer.from(
          `XANDLAND LOGLINE GENERATOR\n${projectTitle}\n\n${allLoglines}`
        ).toString("base64")
      }
    ]
  });
}

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

    const { projectDescription, projectTitle, sessionId, emailAddress } = JSON.parse(body);

    if (!projectDescription) {
      return res.status(400).json({ error: "No project description provided" });
    }

    const title = projectTitle || "Untitled Project";

    // Run all 4 models in parallel
    const [claude, chatgpt, grok, llama] = await Promise.all([
      getLoglines(projectDescription, "claude"),
      getLoglines(projectDescription, "chatgpt"),
      getLoglines(projectDescription, "grok"),
      getLoglines(projectDescription, "llama")
    ]);

    const allLoglines = { claude, chatgpt, grok, llama };

    // Get email from Stripe if not provided
    let emailTo = emailAddress;
    if (!emailTo && sessionId) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        emailTo = session.customer_details?.email || "";
      } catch (stripeErr) {
        console.error("Stripe email lookup failed:", stripeErr.message);
      }
    }

    // Send email
    if (emailTo) {
      try {
        await sendLoglineEmail(emailTo, title, allLoglines);
      } catch (emailErr) {
        console.error("Logline email failed:", emailErr.message);
      }
    }

    // Save to Resend contacts
    if (emailTo) {
      try {
        await fetch("https://api.resend.com/contacts", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + process.env.RESEND_API_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email: emailTo,
            unsubscribed: false
          })
        });
      } catch (contactErr) {
        console.error("Resend contact save failed:", contactErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      loglines: allLoglines,
      projectTitle: title
    });

  } catch (error) {
    console.error("Logline error:", error);
    return res.status(500).json({
      error: "Failed to generate loglines",
      details: error.message
    });
  }
};
