# LayerDeck — Add Chroma Canvas Stack Planner Feature

## What This Is

Add a new page to LayerDeck called **Chroma Canvas Stack Planner**. It's an AI-powered tool that lets Thiago upload an image, sends it to the Anthropic Claude Vision API, and gets back a ready-to-use filament color stack for Bambu Lab's Chroma Canvas tool (makerworld.com/en/makerlab/chromaCanvas).

The output is a step-by-step checklist with copy-paste hex codes, Bambu filament names, and print settings — everything needed to paste directly into Chroma Canvas without guessing.

---

## Where It Lives in LayerDeck

Add it to the **Tools** section of the navigation (or create a Tools section if one doesn't exist). The nav entry should be:

```
Tools
  └── Chroma Canvas Planner
```

Route: `/tools/chroma-canvas` (or follow whatever routing convention LayerDeck uses)

This is a **standalone page** — no new database collections, no Supabase reads or writes, no MQTT, no Pi communication. It's purely a frontend page that calls the Anthropic API directly. It does not touch any existing LayerDeck functionality.

---

## API Key

The Anthropic API key is already stored as a Replit secret: `ANTHROPIC_API_KEY`

**IMPORTANT:** The API call must be made **server-side** (via an Express/API route on the LayerDeck backend), not directly from the browser. This keeps the API key secure.

Create a backend endpoint:

```
POST /api/chroma-canvas/analyze
```

This endpoint:
1. Receives `{ imageBase64, imageType, slots, layerHeight, filamentType, printStyle }` from the frontend
2. Calls `https://api.anthropic.com/v1/messages` with the API key from `process.env.ANTHROPIC_API_KEY`
3. Returns the parsed JSON stack to the frontend

---

## Backend Endpoint

```javascript
// POST /api/chroma-canvas/analyze
// Body: { imageBase64: string, imageType: string, slots: string, layerHeight: string, filamentType: string, printStyle: string }

app.post('/api/chroma-canvas/analyze', async (req, res) => {
  const { imageBase64, imageType, slots, layerHeight, filamentType, printStyle } = req.body;
  
  const ftLabel = { matte: 'Matte PLA', basic: 'Basic PLA', silk: 'Silk PLA', any: 'PLA' }[filamentType] || 'Matte PLA';

  const prompt = `You are an expert at Bambu Lab's Chroma Canvas filament painting tool.

Analyze this image and return a ${slots}-slot color palette optimized for Chroma Canvas at ${layerHeight}mm layer height using ${ftLabel}.
Print style: ${printStyle === 'auto' ? 'auto-detect from image' : printStyle}

IMPORTANT RULES:
- Slot 1 = DARKEST color (background/shadow, printed first at bottom)
- Slot ${slots} = LIGHTEST color (highlight/foreground, printed last at top)
- Sequence must go dark to light for Chroma Canvas depth mapping to work correctly
- Recommend real Bambu Lab ${ftLabel} filament names (e.g. "Bambu Lab Matte Black", "Bambu Lab Matte Ivory White")
- Hex codes should represent printable filament colors, not raw image pixels

Return ONLY valid JSON, no markdown:
{
  "imageSummary": "brief subject description",
  "detectedStyle": "portrait|landscape|logo|abstract",
  "layerHeight": "${layerHeight}",
  "recommendedTotalLayers": 25,
  "recommendedPrintSize": "120x120mm",
  "plateThickness": "1.2mm",
  "slots": [
    {
      "slot": 1,
      "role": "Background / Darkest",
      "colorName": "Rich Black",
      "hex": "#1a1a1a",
      "bambuFilamentName": "Bambu Lab Matte Black",
      "searchTerm": "Bambu Lab Matte Black",
      "roleNote": "what this layer represents visually in the print"
    }
  ],
  "amsLoadOrder": "short tip on AMS slot assignment",
  "printNotes": "2-3 specific Chroma Canvas tips for this image: gradient slider advice, contrast adjustments, layer count recommendation"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: imageType || 'image/jpeg',
                data: imageBase64
              }
            },
            { type: 'text', text: prompt }
          ]
        }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = data.content.map(b => b.text || '').join('');
    const stack = JSON.parse(raw.replace(/```json|```/g, '').trim());
    res.json({ stack });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## Frontend Page

Build the page to match LayerDeck's existing design system (dark theme, same fonts, same card/panel styles, same nav).

The page has two states: **input state** and **results state**.

### Input State

- Image upload zone (drag & drop + click to browse — standard `<input type="file" accept="image/*">`)
- Four dropdowns:
  - **Color Slots:** 3 Colors / 4 Colors (default) / 5 Colors / 6 Colors
  - **Layer Height:** 0.08mm / 0.10mm (default) / 0.12mm / 0.16mm
  - **Filament Type:** Matte PLA (default, best for Chroma Canvas) / Basic PLA / Silk PLA / Any
  - **Print Style:** Auto-detect (default) / Portrait / Landscape / Logo
- "Analyze Image" button — disabled until image is loaded
- When clicked: sends `POST /api/chroma-canvas/analyze` with `{ imageBase64, imageType, slots, layerHeight, filamentType, printStyle }`
- Show a loading spinner while waiting

### Results State

Show results in this exact order:

**1. Image Analysis summary bar** — horizontal row of pills showing:
- Subject (brief image description)
- Style (portrait/landscape/etc)
- Color Slots (number)
- Layer Height
- Total Layers (~25)

**2. Palette strip** — a horizontal color bar showing all slot colors side by side (each slot gets equal width, colors are the hex values from the API response)

**3. Chroma Canvas Setup panel** — green top border, contains a header with an "Open Chroma Canvas ↗" button linking to `https://makerworld.com/en/makerlab/chromaCanvas?from=makerlab` (opens in new tab), and 5 numbered steps:

**Step 1:** "Open Chroma Canvas & Upload Your Image" — text instruction

**Step 2:** "Match These Settings" — show 4 value pills:
- Layer Height (from API response)
- Print Size (from API response)
- Plate Thickness (from API response)  
- Total Layers (from API response)

**Step 3:** "Build Your Custom Palette — Slot by Slot" — grid of slot cards, one per color slot. Each card shows:
- Color circle (filled with the slot's hex color)
- Slot number + role label
- Color name
- Bambu filament name
- Hex code with a one-click COPY button (copies hex to clipboard, button briefly shows "✓ COPIED")
- Role note (what this layer represents)

Below the grid: "Copy All Hex Codes in Order" button — copies all slots as a list like:
```
Slot 1 — Rich Black: #1A1A1A
Slot 2 — Deep Brown: #3D2B1F
...
```

**Step 4:** "Find These Bambu Filaments" — row of clickable tags, one per slot. Each tag shows the color dot + filament search term. Clicking copies the search term to clipboard.

**Step 5:** "Generate, Tweak & Export" — static text: "Hit Generate in Chroma Canvas. If contrast looks flat, drag the gradient curve sliders. Export as .3MF → open in Bambu Studio → send to your A1 or P1."

**4. Print Notes section** — shows AMS load order tip + 2-3 Chroma Canvas tips from the API response

**5. "Analyze Another Image" button** — resets the page back to input state

---

## Design Notes

- Match LayerDeck's existing dark theme exactly — don't introduce new color variables or fonts
- The "Open Chroma Canvas ↗" button should be visually prominent (primary/accent color)
- Slot cards should be in a responsive grid (2 columns on desktop, 1 column on mobile)
- All copy buttons should show a brief "✓ COPIED" confirmation then revert
- The palette strip is decorative — just colored divs side by side, no interaction needed
- Loading state: spinner + "Analyzing image..." text, analyze button disabled

---

## What NOT to Do

- Do NOT store anything in Supabase
- Do NOT add any new database collections or schema
- Do NOT communicate with the Pi or MQTT
- Do NOT add this to any existing printer/inventory/convention pages
- Do NOT call the Anthropic API from the browser — server-side only
- Do NOT create a new backend server — add the endpoint to the existing LayerDeck Express server

---

## Files to Reference

The complete working HTML prototype of this feature (with all styles, markup structure, and the exact API prompt) is attached below. Use it as the source of truth for:
- The exact JSON structure the API returns
- The exact prompt to send to Claude Vision
- The layout and component structure of the results panel
- The copy-to-clipboard behavior

Adapt the styles to match LayerDeck's design system rather than copying them verbatim.
