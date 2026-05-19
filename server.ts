import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- API Routes ---

// 1. Satellite Analysis Proxy
app.post("/api/satellite/analyze", async (req, res) => {
  const { lat, lng } = req.body;
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze deforestation for coordinates ${lat}, ${lng}. 
    According to satellite data trends from 2020-2026, is this area protected? 
    Return JSON: { "safe": boolean, "confidence": number, "report": string }`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    const jsonStr = text.substring(jsonStart, jsonEnd);

    res.json(JSON.parse(jsonStr));
  } catch (error) {
    console.error("Satellite Analysis Error:", error);
    res.status(500).json({ error: "Failed to analyze satellite data" });
  }
});

// 2. DocuSign Envelope Creation (Placeholder)
app.post("/api/docusign/create-envelope", async (req, res) => {
  const { supplierName, ref } = req.body;
  res.json({ 
    status: "sent", 
    envelopeId: "sim_" + Math.random().toString(36).substring(7),
    signingUrl: "https://demo.docusign.net/signing/..." 
  });
});

// --- Middleware for Production / Dev ---
const isNetlify = process.env.NETLIFY || process.env.CONTEXT === "production";

if (!isNetlify) {
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    // Vite middleware for development
    (async () => {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    })();
  }
}

export default app;
