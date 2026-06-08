# Mémoire Persistante & Instructions pour Traverdy

Ce document sert de mémoire à long terme pour l'assistant de codage IA. Tout ce qui est écrit ici est automatiquement injecté dans ses instructions système à chaque nouvelle session de chat.

## 🚀 Contexte du Projet
- **Nom de l'application :** Traverdy (Plateforme d'audit et de conformité forestière face au règlement européen RDUE / EUDR).
- **Rôle principal :** Aider les importateurs à cartographier les parcelles (polygones GPS), lancer des audits satellites contre la déforestation et générer des déclarations de diligence raisonnée (DDS).

## 🛠️ Architecture & Technologies
- **Front-end :** React 18, Vite, Tailwind CSS.
- **Serveur & API :** Express (`server.ts`) gérant les endpoints d'api proxyisés (chiffrement, base de données, etc.).
- **Base de Données & Auth :** Google Firebase Firestore et Firebase Authentication (voir configuration dans `src/lib/firebase.ts`).
- **Cartographie & Géo :** Stockage de polygones GPS, intégration d'analyses satellites.

## 🌐 Hébergement & Déploiement (IMPORTANT)
- **Hébergement Principal de l'Application :** **Render** (gère l'application full-stack avec le serveur Node/Express `server.ts`).
- **Configuration alternative présente :** Le projet contient également des configurations pour **Netlify** (pour des fonctions serverless si besoin, voir `/netlify` et `netlify.toml`).
- **Base de données :** Firestore est hébergé en Europe (Europe de l'Ouest / Cloud Run & Firestore).

## 🔑 Clés API & Intégrations configurées
- **DocuSign API :** Intégration pour la signature électronique des déclarations de diligence raisonnée.
- **Analyse Satellite :** Proxy API `/api/satellite/analyze` connecté à un service d'audit de déforestation.
- **WhatsApp & Mailto :** Liens dynamiques de relance générés pour les producteurs pour saisir leurs coordonnées géographiques de parcelles via leur référence unique.

---
*Note à destination de l'IA : Veuillez toujours vous référer à ce fichier au démarrage pour ne pas redemander à l'utilisateur ses choix d'architecture ou ses clés d'API déjà configurés.*
