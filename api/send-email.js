const { Resend } = require("resend");

async function sendCoverageEmail(toEmail, scriptTitle, pdfBuffer) {
  const resend = new Resend(process.env.RESEND_API_KEY);

  const pdfBase64 = pdfBuffer.toString("base64");
  const filename = `Screenreads_Coverage_${scriptTitle.replace(/\s+/g, "_")}.pdf`;

  const { data, error } = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: toEmail,
    subject: `Your Screenreads Coverage — ${scriptTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1F3864; padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">SCREENREADS</h1>
          <p style="color: #ccc; margin: 8px 0 0 0; font-size: 14px;">Professional Screenplay Coverage</p>
        </div>
        
        <div style="padding: 30px; background: #ffffff;">
          <h2 style="color: #1F3864;">Your coverage is ready!</h2>
          <p style="color: #333; font-size: 15px; line-height: 1.6;">
            Thank you for submitting <strong>${scriptTitle}</strong> to Screenreads. 
            Your professional screenplay coverage is attached to this email as a PDF.
          </p>
          <p style="color: #333; font-size: 15px; line-height: 1.6;">
            We hope the notes are helpful as you continue developing your script. 
            Good luck with your writing!
          </p>
          <div style="background: #f5f5f5; border-left: 4px solid #2E5D8E; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #555; font-size: 13px;">
              <strong>Tip:</strong> After making revisions based on your coverage notes, 
              consider resubmitting for a fresh read to see how much your script has improved.
            </p>
          </div>
        </div>

        <div style="background: #f9f9f9; padding: 20px 30px; border-top: 1px solid #eee;">
          <p style="color: #333; font-size: 15px; line-height: 1.6;">
            Ready to take your script to the next level? Consider upgrading to our 
            <strong>Triple Coverage</strong> — three independent AI reads plus a 
            consensus analysis that shows you exactly where all three readers agree.
          </p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="https://xandland.com/coverage" 
               style="background: #2E5D8E; color: white; padding: 12px 30px; 
                      text-decoration: none; border-radius: 4px; font-weight: bold;
                      font-size: 15px;">
              Get Triple Coverage
            </a>
          </div>
        </div>

        <div style="background: #1F3864; padding: 15px 30px; text-align: center;">
          <p style="color: #aaa; font-size: 12px; margin: 0;">
            © 2026 Screenreads · xandland.com/coverage
          </p>
          <p style="color: #aaa; font-size: 12px; margin: 5px 0 0 0;">
            You received this email because you submitted a screenplay for coverage.
          </p>
        </div>
      </div>
    `,
    attachments: [
      {
        filename: filename,
        content: pdfBase64,
      }
    ]
  });

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

module.exports = { sendCoverageEmail };
