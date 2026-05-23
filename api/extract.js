const { IncomingForm } = require("formidable");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const xml2js = require("xml2js");

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
    const form = new IncomingForm({
      maxFileSize: 10 * 1024 * 1024,
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const fileArray = files.screenplay;
    const file = Array.isArray(fileArray) ? fileArray[0] : fileArray;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const filename = file.originalFilename || file.name || "";
    const extension = filename.split(".").pop().toLowerCase();
    const fileBuffer = fs.readFileSync(file.filepath);

    let scriptText = "";

    if (extension === "pdf") {
      const pdfData = await pdfParse(fileBuffer);
      scriptText = pdfData.text;

    } else if (extension === "docx") {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      scriptText = result.value;

    } else if (extension === "fdx") {
      const xmlString = fileBuffer.toString("utf8");
      const parser = new xml2js.Parser();
      const parsed = await parser.parseStringPromise(xmlString);

      const extractText = (obj) => {
        if (typeof obj === "string") return obj;
        if (Array.isArray(obj)) return obj.map(extractText).join(" ");
        if (typeof obj === "object" && obj !== null) {
          return Object.values(obj).map(extractText).join(" ");
        }
        return "";
      };

      scriptText = extractText(parsed);

    } else {
      return res.status(400).json({
        error: "Unsupported file type. Please upload a PDF, DOCX, or FDX file."
      });
    }

    if (!scriptText || scriptText.trim().length === 0) {
      return res.status(400).json({ error: "Could not extract text from file" });
    }

    return res.status(200).json({ scriptText });

  } catch (error) {
    console.error("Extraction error:", error);
    return res.status(500).json({
      error: "Failed to extract file text",
      details: error.message
    });
  }
};
