# Ideas – what to build, improve and try next

About a hundred ideas, grouped by area. **S** = an afternoon, **M** = a few days, **L** = a real project.
The ★ ones are what I'd do first.

## 0. The foundation (do this before anything else gets big)

1. ★ **L – A real backend and sync.** Everything lives in one browser today. Accounts, a database
   (e.g. Supabase/Postgres) and file storage make it multi-device, multi-user, and let clients open
   their portal, Pages and the Brand Assistant from anywhere. Everything below gets better with it.
2. ★ **M – Real sign-in** for studio members and clients (magic links), with roles per project.
3. **M – Live collaboration**: see who's in a design or proposal, with presence cursors.
4. **S – Automatic backups** to the cloud instead of the "time for a backup" banner.
5. **M – Real email sending** (Resend/Postmark) for invites, reminders and review requests.
6. **M – Stripe live** (the functions are ready) – and a customer portal for invoices and cards.
7. **S – Error and usage reporting** (Sentry + simple product analytics) to see what breaks and what's used.

## 1. Content Machine

8. ★ **M – Brand templates library**: every studio saves its best layouts as templates per client, and starts new posts from them.
9. **M – Auto-resize everything**: one design → every social size at once, each laid out properly (not just scaled).
10. **S – Snap to the brand's type scale** – font sizes jump between the hub's steps.
11. **M – Variable data from Google Sheets** (live, not just pasted): menus, price lists, event posters that update.
12. **M – Carousel mode** – swipeable Instagram carousels where one image runs across slides.
13. **S – Safe zones for Reels/TikTok UI** shown while designing (partly there – make it a toggle per platform).
14. **M – Video layers** – drop in a clip, trim it, put text and the logo on top, export MP4.
15. **M – Audio for motion** – a music bed from a royalty-free library, cut to the animation's length.
16. **S – Animated GIF export** for email banners.
17. **M – Real CMYK/PDF-X export** through a server function for fussy printers.
18. **S – Spot colour and Pantone fields** in the brand hub, used in print exports.
19. **M – Smart layouts**: "make this less busy", "more contrast", "make it feel premium" – AI edits of the layout, not just the text.
20. **S – Brand-check score** on every design card in the list, so off-brand work stands out.
21. **M – Comments pinned to layers** that follow the layer when it moves.
22. **S – Version compare** – slide between two saved versions.
23. **M – Figma import** of frames as editable artboards.
24. **S – Keyboard shortcut cheat sheet** that's searchable (⌘/ in the editor).

## 2. Mockups

25. ★ **M – Photo-real scene packs**: a set of real photographed scenes (desk, street, shop window) with the four corners and lighting already set – pick and go.
26. **S – Lighting presets per scene** (morning, evening, overcast) beyond Studio / Sun / Plant.
27. **M – Animated mockups** – a slow camera turn exported as MP4 for social.
28. **S – Background from the brand** – the scene's floor in a brand colour or texture.
29. **M – More products**: signage on a wall, shop window vinyl, bus shelter, vehicle wrap, flag, badge, stickers sheet, apparel (done properly with real cloth).
30. **S – Mockup sets** – "Brand launch pack": cards + letterhead + tote + phone rendered in one click as a presentation.
31. **M – Put mockups straight into a presentation** (the Decks feature) for the client.
32. **S – Transparent PNG export** of the object alone for use in other designs.
33. **L – AR preview** – see the poster on your own wall through the phone camera (WebXR).

## 3. Brand hub

34. ★ **M – Brand hub from a website** – paste the client's URL, get colours, fonts, logo and tone pulled in (Brand Audit is half of this already).
35. **M – Logo generator for variants** – auto-create the mono, reversed, stacked and icon versions from one logo.
36. **S – Usage rules as a checklist** clients can tick through ("Before you post: …").
37. **M – Brand guidelines PDF** generated from the hub, with a cover in the brand.
38. **S – Colour accessibility matrix** – every colour pair with its contrast score.
39. **M – Tone of voice trainer** – paste a text, get it rewritten in the brand's voice with notes on what changed.
40. **S – Hub changelog** that clients can subscribe to ("The brand got a new accent colour").
41. **M – Brand assets CDN** – stable links to the latest logo files for the client's website and email signatures.
42. **S – Downloadable font packs** (where the licence allows) for the client's team.

## 4. Client portal

43. ★ **M – A mobile app feel** – installable portal (PWA) with push notifications for "Your review is ready".
44. **S – Approve with a swipe** on phones for designs and posts.
45. **M – Client uploads** – a drop zone for photos, copy and feedback files with the right project tags.
46. **S – "Where are we?" timeline** – the project's phases, today, and what's next, in plain words.
47. **M – Video walkthroughs** – record a Loom-style screen + voice explanation straight on a design.
48. **S – Portal in the client's language automatically** by their browser, with a switch.
49. **M – Client satisfaction check** at the end of each phase (one question, one tap).

## 5. Projects & workflow

50. ★ **M – Automations builder** ("when the proposal is signed → create the discovery tasks, send the welcome email").
51. **S – Time estimates vs actuals** per phase, with a warning at 80%.
52. **M – Resource planning** – who's free next week, drag work onto people.
53. **S – Recurring tasks** for retainers ("Monthly social pack").
54. **M – Project templates** from finished projects ("Brand identity – small").
55. **S – Focus mode** – just today's tasks, nothing else on screen.
56. **M – Freelancer access** – invite a freelancer to one project only, with their hours tracked.
57. **S – Calendar sync both ways** with Google/Outlook (today it's export only).

## 6. Sales & clients

58. ★ **M – Proposal analytics** – see when the client opened the proposal, how long they read which part.
59. **M – Brand Audit as a lead magnet** – a public page where prospects run an audit and leave their email.
60. **S – Lead scoring** from the audit, company size and source.
61. **M – E-signatures with MitID** for Danish clients.
62. **S – Pipeline forecast** by month with win probabilities.
63. **M – Case study generator** from a finished project – text, images and results, ready for the website.
64. **S – Testimonials request** sent automatically after handover.

## 7. Money & time

65. **S – Invoice reminders** at 3, 7 and 14 days, in the client's language.
66. **M – Dinero / e-conomic / Billy sync** for Danish bookkeeping.
67. **S – Profitability per project** after hours and costs.
68. **M – Expenses** – snap a receipt, attach it to a project.
69. **S – Retainer health** – hours used vs included, per month, with a nudge before it runs over.

## 8. Apps (new ones for the app store)

70. ★ **M – Menu & price list app** for restaurants and cafés – on-brand menus for print, screen and QR.
71. **M – Event kit app** – invitation, tickets, signage and social posts for one event in one go.
72. **M – Newsletter app** – on-brand email templates, exported to Mailchimp/Brevo.
73. **M – Job ad app** – on-brand job posts for LinkedIn and the careers page.
74. **M – Packaging app** – dielines for boxes and labels, with the mockup in 3D (builds on Mockups).
75. **M – Signage app** – wayfinding signs, door signs and window graphics in real sizes.
76. **M – Photo style app** – apply the brand's photo look (grade, crop, grain) to any photo.
77. **S – QR code app** – on-brand QR codes that link to Pages.
78. **M – Pitch deck app** – investor/partner decks in the brand, from an outline.
79. **L – Website app** – Pages grown up: a small multi-page site on the brand with a CMS.

## 9. AI everywhere (carefully)

80. ★ **M – "Studio copilot"** – ask "what's late?", "draft the invoice for RAY", "summarise the feedback on the logo".
81. **M – Feedback summariser** – 40 client comments → the 5 real decisions to make.
82. **S – Alt text writer** for every image in designs and Pages.
83. **M – Brief-to-moodboard** – a client's discovery answers become a first moodboard.
84. **M – Brand name checker** – domains, trademarks and social handles for a new client name in one go.
85. **S – Caption variants per platform** from one message.
86. **M – Proposal writer v2** – learns from the studio's won proposals.

## 10. The crazy, out-of-the-box ones

87. ★ **L – "Brand twin"** – an AI that has learned the brand so well it can review any design the client makes in Canva or Word and say what's off, before it goes out (a browser extension).
88. **L – Physical brand box** – order a printed "brand launch box" (cards, letterhead, tote, stickers) straight from the mockups, through a print partner.
89. **M – Brand radio** – a short generated audio identity (sonic logo) from the brand's mood words.
90. **M – Brand weather** – a dashboard of how the brand is used in the wild: website, socials, press, scored weekly.
91. **L – Live brand on screens** – Pages as digital signage for the client's shop screens, updated from the studio.
92. **M – The time machine** – play back a brand's journey from first sketch to launch as a video for the case study.
93. **M – Client "brand health" score** the studio can sell as a monthly service.
94. **S – Random on-brand generator** – press a button, get ten wild but on-brand layouts to break the blank page.
95. **M – Voice-to-design** – "a poster for the summer sale, bold, the logo small" spoken on the phone becomes a first draft.
96. **L – Brand-aware Figma plugin** – the brand hub inside Figma, with checks as you design.
97. **M – Studio open day** – a public, live page of the studio's current work (the client-approved parts) for recruiting and sales.
98. **S – "Explain this brand" to a new team member** – a 3-minute interactive tour generated from the hub.
99. **M – Print price comparison** – send the print PDF to several Danish printers' APIs and compare prices and delivery.
100. **L – Aftryk marketplace** – studios sell brand templates, mockup scenes and apps to each other.

## Small polish worth doing anyway

- The Content Machine's zoom starts at 10 % on big print artboards – fit to screen instead.
- Mockup renders are slow in software-only browsers – render a quick preview first, then the fine one.
- The preview browser still shows old demo data ("Forma") – a "reset demo workspace" button.
- The name: keep "Aftryk" as the working name; the logo and name live in one component and one script, so a change later is quick.
