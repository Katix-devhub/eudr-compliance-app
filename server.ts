import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Adjust routing for Netlify serverless execution
app.use((req, res, next) => {
  if (req.url.startsWith("/.netlify/functions/api")) {
    req.url = req.url.replace("/.netlify/functions/api", "/api");
  }
  next();
});

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
import fs from "fs";

const distPath = path.join(process.cwd(), "dist");
const hasDist = fs.existsSync(distPath) && fs.existsSync(path.join(distPath, "index.html"));

const isServerless = process.env.NETLIFY === "true" || !!process.env.LAMBDA_TASK_ROOT;

if (hasDist) {
  // Production Mode: Serve built static files
  console.log("Serving static files from:", distPath);
  app.use(express.static(distPath));
  
  // Explicit route for the root & any non-API URL to serve the React index.html
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });

  if (!isServerless) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Production server running on port ${PORT}`);
    });
  } else {
    console.log("Netlify serverless runtime detected: skipping production app.listen");
  }
} else {
  if (!isServerless) {
    // Vite middleware for development
    (async () => {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
        app.listen(PORT, "0.0.0.0", () => {
          console.log(`Development server running on http://localhost:${PORT}`);
        });
      } catch (err) {
        console.warn("Failed to load Vite dev server:", err);
        // Fallback in case dist is somehow missing but we are forced
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
          res.sendFile(path.join(distPath, "index.html"));
        });
        app.listen(PORT, "0.0.0.0", () => {
          console.log(`Fallback server running on port ${PORT}`);
        });
      }
    })();
  } else {
    console.log("Netlify serverless runtime detected: skipping development app.listen");
  }
}

export default app;
