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

    // Debug — see what keys are coming in
    return res.status(200).json({
      debug: true,
      fileKeys: Object.keys(files),
      fieldKeys: Object.keys(fields),
      filesContent: JSON.stringify(files)
    });

  } catch (error) {
    console.error("Extraction error:", error);
    return res.status(500).json({
      error: "Failed to extract file text",
      details: error.message
    });
  }
};
