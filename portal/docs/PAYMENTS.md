# Taking payments for Aftryk plans

Aftryk is ready for payments: the plans, the purchase window, locking and unlocking features and file
space, and the server functions that talk to the payment provider are all in place. Until a provider
is switched on, buying a plan activates it for free ("beta"), and the app says so.

This guide covers which provider to pick and the steps to switch payments on.

---

## Which provider?

**Recommendation: Stripe.** It fits Aftryk best today: subscriptions in six currencies, VAT worked out
for you, a ready-made page where studios manage their card and receipts, and no monthly fee.

There is no free option. Every card payment costs a fee. The only "free" way is to send invoices and
be paid by bank transfer, but then nothing happens automatically: no renewals, no locking on non-payment.

| | Stripe | Paddle | Frisbii (Danish, formerly Reepay) | Bank transfer |
|---|---|---|---|---|
| What it is | Payment platform – you are the seller | Merchant of record – Paddle is the seller | Danish subscription platform | Invoices you send yourself |
| Fees | 1.5% + 1.80 kr. (EEA cards) + 0.7% Billing + 0.5% Tax | 5% + $0.50, everything included | Monthly fee + per transaction | Free |
| VAT | Stripe Tax calculates it; **you** register (OSS) and file | Paddle handles all VAT/sales tax worldwide | You handle it | You handle it |
| MobilePay subscriptions | No (MobilePay only for one-off payments) | No | **Yes** | – |
| Automatic renewals and locking | Yes | Yes | Yes | No |
| Code already in Aftryk | **Yes** (`api/billing/`) | No | No | – |

**Example: a Danish studio on Pro, paying 249 kr. + 25% VAT = 311.25 kr. a month by Danish card**
- Stripe: card 6.47 + Billing 2.18 + Tax 1.56 ≈ **10.20 kr. a month** (about 4% of the 249 kr.)
- Paddle: 15.56 + ~3.40 ≈ **19 kr. a month** (about 7.6%), but no VAT admin at all

**When to choose something else**
- **Paddle:** if you'll sell a lot outside Denmark and don't want to register for and file EU VAT (OSS)
  or foreign sales tax yourself. You pay more per sale, but Paddle takes on the tax admin.
- **Frisbii:** if Danish studios ask to pay by MobilePay subscription. Most studios are businesses
  paying by card, so start with Stripe and add this only if customers ask.

Prices and fees change; check them when you sign up:
[Stripe (DK)](https://stripe.com/en-dk/pricing) ·
[Paddle](https://www.paddle.com/pricing) ·
[Frisbii](https://frisbii.com/payment-gateway-pricing/)

---

## What's already built

| Where | What it does |
|---|---|
| `src/data/plans.ts` | Plans, prices in DKK / SEK / NOK / EUR / GBP / USD, extra-space packs, what each plan unlocks |
| `src/data/countries.ts` | The studio's country → currency and the VAT on Aftryk's invoice (DK VAT, EU reverse charge, EU OSS rate, none outside the EU) |
| `src/app/Checkout.tsx` | The purchase window: plan, monthly/yearly, extra space, invoice details, total with VAT |
| `src/app/Plan.tsx` | Settings → Plan: usage, subscription, cancel/resume, “Payment method & receipts” |
| `src/data/billing.ts` | The one place that decides what “buy” does: beta activation today, Stripe once switched on |
| `src/data/space.ts` | Stops uploads when the plan's file space is full |
| `api/billing/checkout.ts` | Creates a Stripe Checkout session (subscription, Stripe Tax, VAT-number field) |
| `api/billing/session.ts` | Confirms a finished checkout with Stripe before the plan unlocks |
| `api/billing/portal.ts` | Opens Stripe's customer portal (card, receipts, cancel) |
| `api/billing/webhook.ts` | Receives Stripe's events (renewals, failed payments, cancellations) |

---

## Step by step

### 1. Create the Stripe account
1. Sign up at stripe.com with the company (CVR) and a Danish bank account for payouts.
2. Complete the verification ("Activate payments"). Until then everything runs in **test mode**, which is what you want for steps 2–8.

### 2. Create the products and prices
In Stripe → **Product catalogue**, create three products:

| Product | Prices to add |
|---|---|
| Aftryk Pro | Monthly (recurring, every month) and Yearly (recurring, every year) |
| Aftryk Studio | Monthly and Yearly |
| Aftryk extra space (100 GB) | Monthly and Yearly |

For **every price**, click **Add currency** and add all six currencies with the amounts from
`src/data/plans.ts`. Yearly is ten months (see `YEARLY_MONTHS`). For example, Pro:

| | DKK | SEK | NOK | EUR | GBP | USD |
|---|---|---|---|---|---|---|
| Monthly | 249 | 390 | 390 | 35 | 32 | 39 |
| Yearly | 2,490 | 3,900 | 3,900 | 350 | 320 | 390 |

Copy each price's id (`price_…`). You'll need all six in step 5.

> If you change a price in `plans.ts`, change it in Stripe too. The purchase window shows the
> `plans.ts` amount, but Stripe charges its own.

### 3. Switch on Stripe Tax
1. Stripe → **Tax** → set the origin address (Denmark) and the product tax category **"Software as a service – business use"**.
2. Add your registrations: **Denmark**. If you sell to EU customers *without* a VAT number, register for **EU OSS** (One-Stop-Shop) at skat.dk and add it in Stripe as well.
3. Checkout already asks for a VAT number and turns on automatic tax. EU businesses with a valid number get reverse charge automatically.

### 4. Set up the customer portal
Stripe → **Settings → Billing → Customer portal**:
- Allow: update payment method, view invoices, **cancel at end of billing period**.
- Allow switching plans between Aftryk Pro and Aftryk Studio (monthly and yearly prices).

### 5. Add the environment variables in Vercel
Vercel → your project → **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_PAYMENTS` | `stripe` – switches the purchase window from “free in beta” to Stripe |
| `STRIPE_SECRET_KEY` | `sk_test_…` now, `sk_live_…` when you go live |
| `STRIPE_WEBHOOK_SECRET` | from step 6 |
| `STRIPE_PRICE_PRO_MONTHLY` / `…_YEARLY` | the price ids from step 2 |
| `STRIPE_PRICE_STUDIO_MONTHLY` / `…_YEARLY` | 〃 |
| `STRIPE_PRICE_STORAGE_MONTHLY` / `…_YEARLY` | 〃 |

`VITE_PAYMENTS` is read when the site is built, so redeploy after setting it.

### 6. Add the webhook
Stripe → **Developers → Webhooks → Add endpoint**:
- URL: `https://<your-domain>/api/billing/webhook`
- Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy the **signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

### 7. Save subscriptions on the server — done, needs switching on

The plan no longer lives only in the studio's browser. `supabase/migrations/0002_subscriptions.sql`
adds a `subscriptions` table whose point is who may write it: the studio may **read** its own row
and never change it, because there is no insert, update or delete policy. Only Stripe's webhook
writes, with the service-role key, which skips row-level security. The rules are tested for real in
`src/__tests__/cloud-db.test.ts`.

To switch it on:

1. Run the migration (Supabase SQL editor, or `supabase db push`), after `0001`.
2. Add two server-side variables in Vercel (no `VITE_` prefix, so they never reach the browser):

   | Variable | Where from |
   | --- | --- |
   | `SUPABASE_URL` | the same URL as `VITE_SUPABASE_URL` |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role`. **Secret** — it ignores every policy |

3. That's it. `api/billing/webhook.ts` writes each event (created, renewed, cancelled, card failed),
   `api/billing/checkout.ts` records which studio is buying — checked against the caller's session,
   so nobody can buy a plan onto someone else's studio — and the app reads the row on sign-in
   (`src/data/cloud/plan.ts`).

A card being retried (`past_due`) keeps the studio working; Stripe cancels the subscription itself
once its retries run out, and that drops the studio to Free.

**One thing is deliberately left:** a studio with *no* row is left alone rather than forced to Free,
because plans are switched on without paying while Aftryk is in beta. When the beta ends, make the
absence of a row mean Free — it is the one `return null` in `planPatch`.

Still worth doing: enforce the limits on the server too. File uploads to Supabase Storage should
check the plan's space (`storageGb` in `plans.ts`), and `api/proposal.ts` should check the plan
before spending a Claude call on a draft.

### 8. Test everything in test mode
1. Run the site with `vercel dev` (it runs the `api/` functions as well), and forward webhooks with the Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/billing/webhook
   ```
2. Buy Pro with the test card **4242 4242 4242 4242**, any future date and any CVC.
3. Check that the plan unlocks, then test these cases:
   - yearly billing
   - extra space
   - a Danish, a German (with and without a VAT number) and a US address, to see the VAT change
   - cancelling in the portal
   - the failing card **4000 0000 0000 0341**

### 9. Go live
1. Put the terms of sale, privacy policy and cancellation rules on the website, and link them from the purchase window.
2. In Vercel, swap the test keys and price ids for the live ones: create the products again in live mode, or copy them over from test mode in Stripe.
3. Redeploy, and make one real purchase yourself (you can refund it).
4. Tell the beta studios well in advance before their first charge. Beta subscriptions have `provider: 'beta'`, so they're easy to find.

---

## How locking and unlocking works

- **Features:** `hasFeature(state, 'contentMachine' | 'aiDrafts' | 'customDomain' | 'hubHosting' | 'whiteLabel')` in `plans.ts`. Locked places show an upgrade note that links to the right plan.
- **Limits:** `canAdd(state, 'activeProjects' | 'members')`. New projects and new team members stop at the plan's limit. Sample projects and sample people don't count.
- **File space:** the plan's space plus 100 GB per extra pack. Uploads stop when it's full, for the studio and for clients uploading to their portal.
- **Cancelling:** the plan runs to the end of the period paid for (`cancelAt`), then the studio is on Free and the paid features lock. Nothing is deleted, so upgrading again unlocks everything.
