# Beta: what to build next

## Delivered in this iteration

- Case index, category filters, saved inspiration and empty states.
- Individual concept cases with narrative chapters, palettes, an interactive type specimen and next-case navigation.
- Seven client case URLs linked from the logo strip. These explicitly say “case coming soon” until approved project material is supplied.
- Services and studio subpages.
- A three-step project planner with local drafts, selected services, case inspiration, timing, validation, text brief download and optional booking.
- Cross-page transitions with a native shared-element transition where supported and a short fade fallback. Reduced motion remains respected.
- Logo-strip fade/blur at the edges and clickable client marks.

## Highest-value next steps

| Idea | Why it helps | What is needed |
| --- | --- | --- |
| Real client stories | Turn the seven names into evidence of the work. | Approved project description, deliverables, images and permission to publish. |
| Rendered Beta Review | Make analysis reflect what visitors actually see, including computed typography and loaded assets. | A bounded browser-rendering worker, abuse controls and real-site fixtures. |
| Visual brand guide export | Let leads leave with a designed PDF rather than plain text. | A report template, actual extracted data and export/rendering tests. |
| Secure portal onboarding | Let Beta invite clients and assign projects through a staff UI. | Supabase owner-only RPCs, client access controls and account tests. |
| Full gallery per case | Show the work at a useful size on every screen. | Approved high-resolution assets; captions, alt text, keyboard navigation and a lightbox. |
| Booking connected to the brief | Make “next step” carry context rather than restart the conversation. | The actual booking destination and supported integration. |

## Further improvements and features

| Idea | Practical version |
| --- | --- |
| Before/after case slider | Use approved old/new brand assets and explain the choices. Never invent a client’s previous identity. |
| Case-to-brief inspiration board | Expand saved cases into a small reference board with private notes; keep local-only until account storage is agreed. |
| Review-to-brief continuity | Include the website URL and detected brand findings in the project brief. |
| Better typography analysis | Resolve CSS variables and inspect real loaded fonts; clearly separate source declarations from computed results. |
| Palette accessibility insights | Show contrast between selected detected colours, explain context and avoid blanket “accessible brand” scores. |
| Honest qualitative recommendations | Tie each recommendation to a concrete finding, with uncertainty and source provenance. |
| Case-specific page transitions | Refine card-to-hero movement, typography timing and image transitions using actual assets. Current transitions progressively enhance in supported browsers. |
| More deliberate scroll motion | Use restrained chapter reveals, layered artwork and progress cues; retain reading order and disable motion when requested. |
| Smoother media loading | Add responsive image sizes and deliberate placeholders; reserve layout space to avoid page jumps. |
| Interactive process map | Show what Beta needs from the client at each stage, linked to a matching brief or portal action. |
| Brief file attachments | Add secure uploads after deciding retention and storage; do not treat local text exports as submitted projects. |
| Client feedback timeline | Bring approvals, version changes and next actions into one client-visible timeline with scoped data. |
| Portal version comparisons | Compare approved/current uploads and reject approvals for stale versions. The server already checks versions. |
| Danish/English switch | Translate editorial copy and persisted planner choices consistently; preserve locale in links and exports. |
| Studio availability | Publish a manually maintained status or a real capacity-derived signal, not a random “spots left” counter. |
| Structured service estimates | Show ranges only after Beta supplies rates and scope rules. Keep the quote nonbinding and transparent. |
| CMS editing | Give Beta a private way to edit approved cases and services without rebuilding templates by hand. |
| Search and discovery | Improve metadata, sitemap, canonical URLs and structured data once the final public domain is known. |
| Performance budget | Keep animation work on transforms/opacity, compress assets, track layout shift and test slower devices. |
| Lead-flow analytics | Measure review → brief → booking with an agreed privacy/consent approach and real event definitions. |

## Recommended next batch

1. Publish one real client case from approved materials, including a proper image gallery.
2. Connect a real booking destination and carry the brief’s context into the conversation.
3. Improve Beta Review with rendered-page evidence and a visual export.

These are proposed future tasks, not claims that integrations or case content already exist. The current site is still local development; public deployment, live client account verification and external review fetching remain separate validation steps.
