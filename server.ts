import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";
import axios from "axios";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // --- API Routes ---

  // 1. Satellite Analysis Proxy (Sentinel Hub Placeholder)
  app.post("/api/satellite/analyze", async (req, res) => {
    const { lat, lng } = req.body;
    
    try {
      // Dans une version réelle, on appellerait l'API Sentinel Hub ici
      // const token = await getSentinelHubToken();
      // const image = await getSatelliteImage(token, lat, lng);
      
      // Simulation d'une analyse via Gemini Vision
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      // On simule l'envoi de l'image (ici on envoie juste le contexte)
      const prompt = `Analyze deforestation for coordinates ${lat}, ${lng}. 
      According to satellite data trends from 2020-2026, is this area protected? 
      Return JSON: { "safe": boolean, "confidence": number, "report": string }`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Nettoyage sommaire du JSON retourné par l'IA
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
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
    // Ici on appellerait l'API DocuSign
    res.json({ 
      status: "sent", 
      envelopeId: "sim_" + Math.random().toString(36).substring(7),
      signingUrl: "https://demo.docusign.net/signing/..." 
    });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
