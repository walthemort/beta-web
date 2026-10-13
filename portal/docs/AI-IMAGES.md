# AI images and words in the Content Machine

The editor's **AI** tab can:

- **Make an image** from a description: a photo, an illustration or a graphic in the brand's
  colours, or a calm background to put text on. With "Follow the brand" on, the brand hub's colours
  and its photo direction ("Imagery") are added to the description.
- **Work on a photo**: remove its background, extend it to fill the artboard, or change it with
  words ("make it evening", "add snow").
- **Write copy in the brand's voice**: five headlines, short texts or calls to action, written from
  the tone of voice in the brand hub.

Everything runs on the server (`api/image.ts`, `api/copy.ts`), so the keys never reach the browser.
Without the keys, the tab says AI isn't switched on yet, and the rest of the editor works as usual.

---

## Which provider? fal.ai

**Recommendation: [fal.ai](https://fal.ai).** One key reaches several image models, and Aftryk picks
the right one for each job:

| Job | Model on fal | Price (Sept 2026, check before launch) |
|---|---|---|
| Photo | FLUX.2 [pro] | ≈ $0.03 for a 1 MP image, $0.045 for 1920×1080 |
| Illustration, background | Recraft V3 (with the brand's colours as a palette) | $0.04 |
| Graphic (vector) | Recraft V3, vector style | $0.08 |
| Change a photo with words | FLUX.2 [pro] edit | ≈ $0.03–0.06 |
| Remove a background | BiRefNet v2 | a fraction of a cent (billed per second) |
| Extend a photo | Bria Expand | ≈ $0.023 |

- **No subscription:** you pay per image, from prepaid credit. The credit also acts as a spending cap.
- **Plan allowance:** Pro includes 150 AI images a month and Studio 600 (`aiImages` in
  `src/data/plans.ts`). Even at the most expensive model, 150 images cost about $6, against a
  $39 plan.
- **Brand colours:** Recraft takes the brand's colours as an actual palette, so illustrations and
  backgrounds stay on brand.

**Other providers,** if you'd rather:
- **OpenAI (GPT Image):** best at readable text inside images, but more expensive.
- **Google (Imagen / Gemini "Nano Banana"):** strong photos and editing.
- **Replicate:** hosts much the same models as fal.

Switching provider only means changing `imageJob()` in `src/features/content/ai.ts` and the fetch in
`api/image.ts`; the editor doesn't change.

**Copy** uses Claude, with the same `ANTHROPIC_API_KEY` as the AI proposal drafts.

---

## Switching it on

### 1. Create the fal account
1. Sign up at [fal.ai](https://fal.ai) with the company's email.
2. **Billing:** add prepaid credit (start with $20–50). Leave automatic top-up **off** until you
   know how much studios use; the credit then works as a hard cap.
3. **Settings → API keys:** create a key and copy it.

### 2. Try it on your computer
Create a file called `.env.local` in the project folder (it's git-ignored, so it's never committed):

```
FAL_KEY=your-fal-key
ANTHROPIC_API_KEY=your-anthropic-key
```

Restart `npm run dev`. The dev server now runs the functions in `api/` too, so the AI tab works
straight away. Open a design → **AI** → describe an image → **Make**.

### 3. Switch it on for everyone
In Vercel → your project → **Settings → Environment Variables**, add `FAL_KEY` (and
`ANTHROPIC_API_KEY` if it isn't there already), then redeploy. `vercel.json` gives the image
function 60 seconds to finish, which covers the slowest models.

---

## Before the public launch

- **Count usage on the server.** Today the monthly allowance is counted in the studio's browser,
  like the rest of Aftryk's data. Once Supabase is connected, keep an `ai_usage` table (studio,
  month, images) and have `api/image.ts` check and count there before calling fal.
- **Require sign-in.** `api/image.ts` and `api/copy.ts` refuse calls from other websites, but
  anyone could still call them directly. When Aftryk has accounts, check the session first; until
  then, keep the fal credit small.
- **Terms:** FLUX.2 [pro], Recraft and Bria may be used commercially through fal's API; Bria is
  trained only on licensed images. Check each model's terms on fal, and tell studios in your terms
  that AI images and text should be checked before use.
- **Privacy:** images and descriptions are sent to fal.ai (USA), and descriptions of posts to
  Anthropic. Mention both in the privacy policy and sign their data processing agreements.
