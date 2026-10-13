# Aftryk

The creative studio workspace. Vite + React + TypeScript.

## Brand

Name, logo, colours and type: **[docs/BRAND.md](docs/BRAND.md)**. Logo files are in `public/brand/`.

## Run it

```bash
npm install   # first time only
npm run dev   # then open http://localhost:5173
```

## Pages

| URL | What |
| --- | --- |
| `/` | Landing page + request-access form |
| `/portal` | Client portal sign-in |
| `/app` | Studio workspace – Home (inbox + my tasks) |
| `/app/projects`, `/board`, `/calendar`, `/documents` | Projects section: list, board, calendar, and every questionnaire/proposal/contract/file |
| `/app/clients`, `/app/sales`, `/app/sales/find` | Clients section: clients, sales pipeline, lead finder |
| `/app/invoices`, `/reports`, `/capacity` | Money & time section |
| `/app/projects/:id/…` | A project, grouped by phase: Overview · Win (discovery, proposal, contract) · Create (presentations, routes, files) · Deliver (brand hub, handover) · Money & time |
| `/p/:projectId/…` | **Client portal** for one project: review files, questionnaire, accept proposal, sign contract, brand hub |
| `/app/apps` | The apps: turn them on and off (see below) |
| `/site/:slug` | A page made with **Pages** (link-in-bio, coming soon, campaign) |
| `/print/invoice\|proposal\|contract/:id` | Printable documents (Save as PDF) |

Press **⌘K** (Ctrl+K) in the workspace to search everything.

## The client flow

1. **Discovery** – send the questionnaire link; the client fills it in.
2. **Proposal** – write it with line items, mark as sent, share the link; the client accepts.
3. **Contract** – created from the accepted proposal; the client signs by typing their name.
4. **Invoice** – one click invoices the 50% deposit.
5. **Files** – upload (same file name = new version), share for review. The client pins comments on the image and approves or requests changes.
6. **Brand hub** – approved logos, colours and fonts in one downloadable page.

## Automations

Settings → Workflow → Automations. When a client accepts a proposal, a draft contract is created;
when every file in review is approved, the project moves to Delivery (which also creates the
“At delivery” invoice from the payment plan). Client comments can be turned into tasks in one
click, and finishing such a task resolves the comment.

## AI proposal drafts

Once a client has answered the discovery questionnaire, the Proposal tab offers
“Draft the proposal”: the answers, the studio's template for the service and past prices go to
`api/proposal.ts`, which asks Claude for a first draft. Set this where the app is hosted:

| Variable | What |
| --- | --- |
| `ANTHROPIC_API_KEY` | An API key from console.anthropic.com |

Without it (or when running `npm run dev`, which has no `/api`), the button still works: it makes
a plainer draft from the template with the client's answers quoted in it.

## AI in the Content Machine

The Content Machine makes images (photos, illustrations, backgrounds in the brand's colours), edits
photos (remove the background, extend, change with words) and writes copy in the brand's voice. Add
`FAL_KEY` and `ANTHROPIC_API_KEY` to `.env.local` (or Vercel) to switch it on – `npm run dev` also runs
the functions in `api/`. See [docs/AI-IMAGES.md](docs/AI-IMAGES.md).

## Apps

Apps are extra tools that run on a client's brand hub. Free has none, Pro picks three, Studio has them
all (`hasApp` in `src/data/plans.ts`; the list is `src/data/apps.ts`). Email signatures are free on
every plan (brand hub → Email signatures; the team copies theirs in the client portal).

| App | Where | What |
| --- | --- | --- |
| Content Machine | `/app/content` | Posts, banners and slides – with a **Print** tab (business cards, flyers, posters with bleed, crop marks and preflight) and a **Motion** tab (animate layers, export MP4) |
| Mockups | `/app/mockups` | A design, file or logo on business cards, a poster, phone, laptop, T-shirt, tote bag, billboard – or your own photo (drag the four corners) |
| Presenter | `/app/presenter` | A PowerPoint with slide masters in the brand (opens in Keynote and Google Slides) and a Word letterhead |
| Social Planner | `/app/calendar/social` | Posts in the calendar; the client approves them in the portal |
| Pages | `/app/pages` | Small web pages on the brand, online on `/site/<slug>`, with sign-ups |
| Brand Assistant | `/app/assistant` | “Ask the brand” in the client portal: answers from the brand hub (`api/assistant.ts`, needs `ANTHROPIC_API_KEY`) |
| Brand Audit | `/app/audit` | A report on any website's colours, fonts and basics, compared with a brand hub (`api/audit.ts`; with `ANTHROPIC_API_KEY` it adds a verdict and three improvements) |

The audit fetches addresses people type in, so it only connects to public addresses: names are
resolved and checked when the connection is made, redirects are followed by hand and re-checked, and
downloads are capped in size and time.

## Plans and payments

Aftryk has three plans (Free, Pro, Studio) with prices in the studio's own currency, set by the country it
picks in setup. Settings → Plan shows usage and the subscription, and the purchase window handles
monthly or yearly billing, extra file space and VAT. Paid features, project and team limits, and file
space lock and unlock with the plan.

Payments aren't switched on yet: buying a plan activates it for free while Aftryk is in beta. The Stripe
functions are ready in `api/billing/`. **[docs/PAYMENTS.md](docs/PAYMENTS.md)** compares the payment
providers and walks through switching payments on.

## Company lookup (CVR)

The Sales page can fill in a lead's CVR number, address, industry and size from the Danish company
register. The register needs credentials, so the call is made by `api/cvr.ts` on the server — never
from the browser, where anything would be public.

Set these where the app is hosted (Vercel → Settings → Environment Variables):

| Variable | What |
| --- | --- |
| `VIRK_URL` | The search endpoint from Erhvervsstyrelsen, e.g. `http://distribution.virk.dk/cvr-permanent/_search` |
| `VIRK_USER` | Username from the access mail |
| `VIRK_PASSWORD` | Password from the access mail |

Without them the app still runs; the lookup button simply reports that it isn't configured.
A studio can point somewhere else entirely in Settings → Studio → Company lookup endpoint
(`{q}` is replaced with the search text).

## The cloud

Sign-in, a shared studio workspace and files in the cloud, on Supabase – off until it's set up.
The steps: **[docs/BACKEND.md](docs/BACKEND.md)**.

## Where data lives (for now)

Everything is saved in this browser: data in `localStorage`, uploaded files in IndexedDB.
Client links therefore only work on this computer until there's a real backend.
Settings → "Download backup" saves the data (not uploaded files) as JSON.

**Next:** Supabase (login, shared database, file storage) + Vercel (hosting), so client links work for real clients.
