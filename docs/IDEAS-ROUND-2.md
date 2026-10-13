# Beta — next product ideas

Ideas 1, 6 and 11 are implemented. The remaining entries are proposals. Existing galleries, saved inspiration, PDFs, language switching, service estimates, private editing and portal uploads are already available, so this list develops those foundations further.

| # | Idea | Visitor/client benefit | What it needs |
| --- | --- | --- | --- |
| 1 | Mobile + desktop review | Compare the same brand at two screen sizes, with a switch inside the expanded review. | Two bounded render snapshots and responsive evidence. |
| 2 | Brand consistency map | Compare a few selected pages and show where colours, type and hierarchy diverge. | Bounded same-site traversal and page-level evidence. |
| 3 | Personalised next-step cards | Turn review findings into a short, prioritised action list that can feed the brief. | Transparent finding-to-action rules; distinguish automated observations from designer recommendations. |
| 4 | Email my review | Deliver the report and a clear next step to leads who explicitly request it. | Email provider, consent, delivery/rate limits and retention settings. |
| 5 | Private, expiring review links | Share a report with a colleague without asking them to rerun the review. | Durable report storage, unguessable tokens, expiration and owner revocation. |
| 6 | Adaptive project questions | Ask useful follow-ups for branding, website or content work, based on the selected services. | A small editable question catalog, draft storage and export integration. |
| 7 | Curated service bundles | Offer purposeful combinations with clear deliverables, while retaining custom projects. | Approved bundle names, scope, inclusions and actual pricing rules. |
| 8 | A living brand preview | Let a lead try their own company name, detected colours and typography in illustrative layouts. | Clearly labelled previews, safe local rendering and appropriate font permissions. |
| 9 | Sector and challenge case discovery | Find relevant work by industry or problem, not only service category. | Approved case tags, search and meaningful empty states. |
| 10 | Behind-the-design chapters | Short annotated videos or designer notes explain why particular decisions were made. | Approved media, captions/transcripts and performance-conscious loading. |
| 11 | Pin feedback onto a design | Clients place a comment exactly where a change is needed in an image or PDF. | Version-bound coordinates, scoped comments and accessible text alternatives. |
| 12 | Approval checklist per delivery | Review a delivery as a set of assets and required decisions, with an explicit final confirmation. | Grouped/version-bound approval rules and an audit trail. |
| 13 | Scope-change requests | Show what a requested addition changes in deliverables, schedule and cost before either side accepts. | Owner-approved proposals, revision history and explicit acceptance; no fabricated quotes. |
| 14 | Client-controlled notifications | Let clients choose immediate updates or a digest for files, feedback and milestones. | Email delivery, preferences, unsubscribe controls and notification deduplication. |
| 15 | An approved brand library | Keep current logos, colour tokens, usage guidance and downloadable approved assets together in the portal. | Owner-curated assets, per-client access and clear font/asset licensing metadata. |

Implemented batch: adaptive project questions (editable bilingual catalog, persistent draft answers and filtered exports), mobile/desktop review (independent anonymous snapshots, tabs and exports), and pinned design feedback (private raster/PDF preview, per-page/version pins, keyboard positioning and studio resolution). Portal pins require migration 0006; live Supabase and public-site scans still need verification on the intended host.

Implemented alongside this list: direct divider dragging on case and portal comparisons, touch/keyboard controls, corrected header spacing, and a planner sidebar that only displays populated sections and shows current service selections. Placeholder comparisons stay explicitly labelled as concepts.
