import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = files.screenplay?.[0] || files.screenplay;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileBuffer = fs.readFileSync(file.filepath);
    const pdfData = await pdfParse(fileBuffer);
    const scriptText = pdfData.text;

    if (!scriptText || scriptText.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from PDF" });
    }

    return res.status(200).json({ scriptText });

  } catch (error) {
    console.error("PDF extraction error:", error);
    return res.status(500).json({ error: "Failed to extract PDF text" });
  }
}
