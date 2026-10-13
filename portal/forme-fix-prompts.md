# Forme – fix prompts for ChatGPT

Paste ONE prompt at a time into ChatGPT. After each one, tell Claude "done with prompt N" so it can re-check the live site before you move on.

---

## Prompt 1 – Workspace bugs (data + logic)

```
Please fix these bugs in the Forme workspace. Don't change the visual design, only the logic and data.

1. PROGRESS IS INCONSISTENT. The same project shows two different progress numbers:
   - Project cards/overview show a percentage based on stage (RAY = 67%, NORD = 33%, Forma = 50%).
   - The Project board table shows tasks done (RAY = 1/2, NORD = 1/2, Forma = 1/2).
   So RAY looks 67% done in one place and 50% done in another. Pick ONE definition of progress
   (I prefer: stage progress, shown as "Stage 4 of 6 · Design") and use it everywhere. Show task
   completion separately and label it clearly as "Tasks 1/2".

2. DUPLICATE INVOICE NUMBERS. On the Invoices page both RAY and BETA_01 have "INV-001".
   Invoice numbers must be unique per workspace and auto-increment (INV-001, INV-002, ...).
   Never reuse a number, even if an invoice is deleted.

3. EMPTY 0 kr. DRAFT INVOICE. BETA_01 has a draft invoice for 0 kr. with no due date. Don't create
   empty invoices automatically when a project is created; only create one when the user clicks
   "New invoice".

4. BETA_01 DUE DATE. BETA_01 shows "1 Jan" as due date on the Project board, but "No due date"
   in "Next up" on the Overview. A project without a due date should show "No due date"
   everywhere, never a fallback date.

5. BETA_01 TAGLINE. BETA_01's brand hub card shows "A BRIGHTER EVERYDAY." which is RAY's tagline.
   New projects should start with an empty tagline (placeholder text "Add a tagline"),
   not copy another project's.

6. PROJECT NAMES VS TAGLINES. On the Project board the "Project" column shows the tagline
   ("Space for a new perspective.", "A brighter kind of everyday.") instead of a project name,
   except for BETA_01 which shows "BETA_01 BRAND IDENTITY". Every project should have a real
   project name (e.g. "Forma – Brand identity") shown in tables and lists, and the tagline
   shown only as secondary text.

7. "none" DROPDOWN. On the Project board, next to "Customize", there's a dropdown whose value is
   just the word "none" with no label. Give it a proper label (e.g. "Group by") and show
   "No grouping" instead of "none".

8. BRAND HUB CARDS. On "Brand & delivery" every card has the identical subtitle
   "Logo. Type. Colour. Everything together." Replace it with something useful per hub,
   e.g. "3 logos · 2 fonts · 5 colours · Updated 20 Sept".

9. FILE DELETE LABEL. In "Files & assets" the delete button for "text - off-white.svg" is labelled
   "Delete Primary - Off White" (a different name than the file). Button labels must use the
   file's actual name.

10. DELETE CONFIRMATION. Make sure deleting a file, project, client or invoice always asks for
   confirmation first ("Delete text - cobalt.svg? This can't be undone.").
```

---

## Prompt 2 – Workspace on mobile + accessibility

```
Please improve the Forme workspace on phones and for accessibility.

MOBILE (test at 375px wide):
1. On the Project board, you have to scroll past two headlines, "Sales connections", the board tabs,
   "New board", the dropdown, "Customize", the view toggle and 5 filter dropdowns before seeing a
   single project. On screens under 768px:
   - Remove the second headline ("INCLUDED IN EVERY WORKSPACE / A clear view of every moving part.")
     — it repeats the first.
   - Collapse all filters into one "Filters" button that opens a bottom sheet, showing a count
     of active filters.
   - Keep search visible.
2. The projects table is 730px wide on a 375px screen, so Stage, Due date and Progress are cut off.
   Under 768px, render each row as a stacked card instead: name + client on top, then stage pill,
   due date and progress bar.
3. Content on the project board fades in late, leaving a blank white box for a moment. Render
   content immediately; if you keep an animation, make it start from opacity 0.6, not 0, and
   last at most 200ms.

ACCESSIBILITY:
4. On the project page there are 4 icon-only buttons (next to "Copy client portal link") with no
   accessible name. Add aria-label to every icon-only button in the app.
5. The sidebar items (Overview, Projects, Clients, ...) are <button> elements. Make them real
   <a href="/?view=..."> links so users can cmd/ctrl-click to open a section in a new tab and
   copy the link.
```

---

## Prompt 3 – Client portal page

```
The client portal sign-in page (/?view=client-portal) doesn't match the rest of the Forme brand.
Please redesign it to use exactly the same design system as the landing page:

1. Logo: use the same "forme" wordmark component as the landing page header, with the small
   superscript ®. Right now the ® is full-size and inline.
2. Background: use the same warm off-white (#FAFAF8) as the landing page, not white.
3. Text colour: the subtitle is a greenish grey. Use the same neutral grey as the landing page body text.
4. Button: use the same large blue button style as "Request access" on the landing page
   (full width up to ~380px, same height, same arrow icon). Label: "Sign in to your client space".
5. Add a short line underneath: "Don't have access? Ask your studio to invite you."
6. Optional: if the studio has uploaded a logo, show "[Studio name] × forme" at the top, so
   clients recognise who invited them.
```

---

## Prompt 4 – Landing page fixes (technical)

```
Please fix these technical issues on the Forme landing page:

1. Remove <meta name="codex-preview" content="development"> from the page head.
2. Add Open Graph and Twitter tags so links look good when shared:
   og:title "Forme — The creative studio workspace"
   og:description "Manage projects. Present ideas. Deliver beautifully."
   og:image — a 1200×630 image of the hero (the blue "ray." brand hub card on the off-white
   background with the forme logo)
   og:type "website", twitter:card "summary_large_image".
3. When the page first loads it only shows "Opening your space…" until JavaScript runs. Make the
   landing page content (headline, text, buttons, sections) render as static HTML so it's visible
   immediately and to search engines. The loading state should only be used inside the workspace.
4. Scroll animations: in the "What is Forme?" section, cards stay invisible until well into the
   viewport, leaving big blank areas while scrolling. Trigger the reveal as soon as 10% of an
   element is visible (rootMargin "0px 0px -10% 0px"), and never hide content if the user prefers
   reduced motion.
5. In the "Request access" dialog, the gap between "Your name" and "Studio name" is larger than
   between the other fields. Make all field spacing equal.
6. In the header, "EARLY ACCESS" looks like a button but does nothing. Either make it open the
   Request access dialog, or restyle it as a plain small label without a border.
```

---

## Prompt 5 – Landing page content

```
Please improve the content of the Forme landing page:

1. After the hero, add a section with a real screenshot of the workspace (the Overview page with
   the project cards) in a subtle browser frame, with the caption
   "Your studio at a glance. Projects, clients, proposals and invoices in one place."
2. Under the hero subtitle, add one line that says why Forme is different:
   "Replace the Dropbox folder, the PDF brand guide and the endless feedback email."
3. Label the hero mockup so visitors know it's an example: small text above the card
   "Example brand hub".
4. Make the three feature sections more concrete by adding 3 short bullet points under each:
   - Keep the work moving: "Project boards & next steps", "Discovery, proposals & contracts", "Invoices tracked per project"
   - Bring your clients closer: "A private portal per client", "Feedback on every version", "Approve with one click"
   - Make the handover count: "Logos, colours & fonts in one hub", "Every format ready to download", "Print-ready PDFs"
5. After someone submits "Request access", show a clear success message:
   "Thanks, [name]. We review requests within 2 working days and will email you at [email]."
```
