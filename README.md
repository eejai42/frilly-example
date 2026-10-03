# Frilly, rebuilt from one rulebook

A prototype of the [frilly.ai](https://frilly.ai) local directory (Madison, WI
businesses, organizations, makers and events) where **the rulebook decides and
the UI only renders**.

```
effortless-rulebook/effortless-rulebook.json   the single source of truth (content + product definition)
effortless-rulebook/edit-rulebook.sh           boots the rulebook editor: Postgres + generated API + portal
app/                                           the Frilly prototype (Vite + React) - talks only to that API
app/tests/conformance.test.mjs                 one test per user story in the rulebook
scripts/import-frilly-scrape.py                the one-time import of the live site's content
.claude/skills/                                the effortless-* skills, vendored
```

## Run it

```bash
npm install -g @effortlessapi/cli            # once
cd effortless-rulebook && bash edit-rulebook.sh   # API http://localhost:42441, editor http://localhost:42442
cd ../app && npm install && npm run dev      # http://localhost:5173
npm test                                     # conformance suite (needs both running)
```

No Docker? Run the same pipeline on a local Postgres (what this repo was built
with): copy `effortless-rulebook/docker/effortless.editor.json` to
`effortless-rulebook/effortless-editor-src/effortless.json`, symlink
`effortless-rulebook -> ..` inside it, export `DATABASE_URL`, run
`effortless build`, then `node api/index.js` (PORT=42441) and `npx vite` in
`admin-portal/` (port 42442).

Sign in by picking a persona. **Visitor** sees the public site; **Directory
Admin** gets `/admin`: dashboard, listings (feature / publish / edit), events,
categories, user stories, site settings.

## What is derived

55% of the schema's fields are lookups, aggregations or formulas. The app never
computes any of them:

- every URL (`EntityPath`, `EntityUrl`, `MarkdownUrl`, `JsonUrl`, `EventPath`)
- completeness (`HasPhone` … `CompletenessScore`, `CompletenessPercent`, `IsComplete`)
- what shows publicly (`IsListable`, `IsFeaturable`, `IsFeaturedLive`)
- time (`IsUpcoming`, `IsToday`, `IsPast`, `IsListable` on events) from one `Sites.Today`
- every count on the dashboard, city pages and categories
- the product itself: `Routes` (navigation as data), `UserStories.Statement`,
  `Personas.BuildProgressPercent`

Change a rule in the rulebook, rebuild, and the app follows. Try it: set
`Sites.Today` to `2099-01-01` in `/admin/settings` and watch every event go past.
