const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    let body = "";
    await new Promise((resolve, reject) => {
      req.on("data", (chunk) => {
        body += chunk.toString();
      });
      req.on("end", resolve);
      req.on("error", reject);
    });

    const { sessionId } = JSON.parse(body);

    if (!sessionId) {
      return res.status(400).json({ error: "No session ID provided" });
    }

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "Payment not completed" });
    }

    // Determine tier from the session metadata or amount
    const amount = session.amount_total;
    let tier = 1;
    if (amount >= 2995) tier = 3;
    else if (amount >= 2495) tier = 2;
    else tier = 1;

    // Return customer info and tier
    return res.status(200).json({
      verified: true,
      tier: tier,
      customerEmail: session.customer_details?.email || "",
      customerName: session.customer_details?.name || "",
      sessionId: session.id
    });

  } catch (error) {
    console.error("Payment verification error:", error);
    return res.status(500).json({
      error: "Failed to verify payment",
      details: error.message
    });
  }
};
