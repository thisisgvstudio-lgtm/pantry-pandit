# 🍛 Pantry Pandit

AI-powered Indian meal planner. Users just open the app — no API key needed on their end.

---

## How to run locally

1. Install Node.js from https://nodejs.org (free)
2. Open Terminal in this folder and run:

```
npm install
```

3. Copy `.env.example` to `.env` and add your FREE Gemini API key:
   - Go to https://aistudio.google.com/apikey
   - Sign in with your Google account (no payment needed!)
   - Click "Create API Key" → copy and paste it below

```
GEMINI_API_KEY=your-gemini-key-here
```

4. Start the server:

```
npm start
```

5. Open http://localhost:3000 in your browser ✅

---

## Deploy online (free — Render.com)

1. Push this folder to a GitHub repo
2. Go to https://render.com → New Web Service → connect your repo
3. Set Environment Variable: `ANTHROPIC_API_KEY` = your key
4. Done! Render gives you a live URL like `https://pantry-pandit.onrender.com`

---

## Publish to Play Store / App Store

Once deployed online, wrap it as a mobile app using Capacitor:

1. Install Capacitor: `npm install @capacitor/core @capacitor/cli`
2. Run: `npx cap init`
3. Add platforms: `npx cap add android` / `npx cap add ios`
4. Build and submit to stores

Or hire a developer to wrap and publish it for you using the live URL.

---

## Features

- Family size & dietary preference setup
- Pantry input: vegetables, spices, dairy, proteins (with Veg/NV toggle)
- South Indian or North Indian cuisine
- One-time, weekly (7-day), or festival plan
- AI generates recipes using only your pantry items
- Regenerate button for fresh plans
- Print / Save as PDF
