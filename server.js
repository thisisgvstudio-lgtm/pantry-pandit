require('dotenv').config();
const express = require('express');
const cors = require('cors');
const https = require('https');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

app.use(cors({
  origin: function(origin, callback) { callback(null, true); },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));
app.options('*', cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Health check ──────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Pantry Pandit is running 🍛' });
});

// ── Generate meal plan ────────────────────────────────────
app.post('/api/generate', async (req, res) => {
  const { profile, pantry, preferences } = req.body;

  if (!profile || !pantry || !preferences) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const formatItems = (items) =>
    items.map(i => `${i.name} (${i.qty} ${i.unit}${i.type ? ', ' + i.type : ''})`).join(', ') || 'none listed';

  const planInstructions = preferences.planType === 'weekly'
    ? 'Create a FULL 7-DAY meal plan (Monday to Sunday). For each day provide Breakfast, Lunch, and Dinner.'
    : preferences.planType === 'festival'
    ? `Create a special festive menu for ${preferences.festival || 'the occasion'} with appropriate traditional dishes.`
    : 'Create a ONE-DAY meal plan with Breakfast, Lunch, and Dinner.';

  const prompt = `You are Pantry Pandit, an expert Indian chef and nutritionist.

IMPORTANT: Pantry items may be written in any Indian language (Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Gujarati, Marathi, Punjabi, etc.) or in English. Recognise and understand all ingredient names regardless of language or script, and always respond in English.

USER PROFILE:
- Name: ${profile.name}
- Family size: ${profile.familySize} people
- Dietary preference: ${profile.diet}
- Allergies / avoid: ${profile.allergies || 'none'}
- Cuisine style: ${preferences.cuisine}

PANTRY ITEMS AVAILABLE:
- Fresh vegetables: ${formatItems(pantry.vegetables)}
- Spices & dry goods: ${formatItems(pantry.spices)}
- Dairy: ${formatItems(pantry.dairy)}
- Proteins (veg/non-veg): ${formatItems(pantry.proteins)}

TASK: ${planInstructions}

RULES:
1. ONLY use ingredients from the pantry above.
2. Respect the dietary preference strictly.
3. For non-veg dishes, only use proteins tagged as non-veg.
4. Scale quantities for ${profile.familySize} people.
5. Each meal must include: dish name, step-by-step cooking instructions (4-6 clear steps), estimated calories per serving, and pantry items used.
6. Vary the meals — no repeats.
7. Use authentic ${preferences.cuisine} recipes and techniques.
8. Calories should be realistic and per person.

OUTPUT FORMAT — return ONLY valid JSON, no extra text:
${preferences.planType === 'weekly' ? `{
  "plan_type": "weekly",
  "days": [
    {
      "day": "Monday",
      "meals": [
        { "type": "Breakfast", "name": "...", "recipe": "Step 1: ... Step 2: ... Step 3: ...", "calories": 350, "uses": ["item1","item2"] },
        { "type": "Lunch", "name": "...", "recipe": "Step 1: ... Step 2: ... Step 3: ...", "calories": 520, "uses": ["item1","item2"] },
        { "type": "Dinner", "name": "...", "recipe": "Step 1: ... Step 2: ... Step 3: ...", "calories": 480, "uses": ["item1","item2"] }
      ]
    }
  ]
}` : `{
  "plan_type": "${preferences.planType}",
  "title": "${preferences.planType === 'festival' ? (preferences.festival || 'Festival') + ' Special Menu' : "Today's Meal Plan"}",
  "meals": [
    { "type": "Breakfast", "name": "...", "recipe": "Step 1: ... Step 2: ... Step 3: ...", "calories": 350, "uses": ["item1","item2"], "serves": "${profile.familySize}" },
    { "type": "Lunch", "name": "...", "recipe": "Step 1: ... Step 2: ... Step 3: ...", "calories": 520, "uses": ["item1","item2"], "serves": "${profile.familySize}" },
    { "type": "Dinner", "name": "...", "recipe": "Step 1: ... Step 2: ... Step 3: ...", "calories": 480, "uses": ["item1","item2"], "serves": "${profile.familySize}" }
  ]
}`}`;

  try {
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 65536 }
    });

    const geminiRes = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body
    });

    const data = await geminiRes.json();
    if (!geminiRes.ok) throw new Error(data.error?.message || 'Gemini API error');

    const raw = data.candidates[0].content.parts[0].text.trim();
    let jsonStr = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

    // Try parsing as-is first
    let plan;
    try {
      plan = JSON.parse(jsonStr);
    } catch (e) {
      // Response was truncated — attempt repair by finding the last complete meal object
      // Close any open arrays/objects by counting brackets
      const opens = { '{': 0, '[': 0 };
      const pairs = { '}': '{', ']': '[' };
      for (const ch of jsonStr) {
        if (ch === '{' || ch === '[') opens[ch]++;
        if (ch === '}' || ch === ']') opens[pairs[ch]] = Math.max(0, opens[pairs[ch]] - 1);
      }
      // Append missing closers
      let repaired = jsonStr.trimEnd().replace(/,\s*$/, '');
      for (let i = 0; i < opens['{'); i++) repaired += '}';
      for (let i = 0; i < opens['[']; i++) repaired += ']';
      // Close outer wrappers
      if (opens['{'] > 0 || opens['['] > 0) {
        // Re-count after repair attempt
        let o = 0, a = 0;
        for (const ch of repaired) {
          if (ch === '{') o++; if (ch === '}') o--;
          if (ch === '[') a++; if (ch === ']') a--;
        }
        while (a > 0) { repaired += ']'; a--; }
        while (o > 0) { repaired += '}'; o--; }
      }
      plan = JSON.parse(repaired);
    }
    res.json({ success: true, plan });

  } catch (err) {
    console.error('Generation error:', err.message);
    res.status(500).json({ error: err.message || 'Failed to generate plan' });
  }
});

// ── Serve frontend for all other routes ───────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🍛 Pantry Pandit running at http://localhost:${PORT}`);
});
