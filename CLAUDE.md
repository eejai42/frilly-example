# Frilly Example — an Effortless Rulebook (ERB) project

This project follows the **Effortless Rulebook (ERB) methodology**.
`effortless-rulebook/effortless-rulebook.json` is the single source of truth for
the Frilly local directory (a rebuild of the public site https://frilly.ai):
Sites, Cities, EntityTypes, Categories, Subcategories, Listings, Events — plus
the product definition itself: Personas, Routes, UserStories, AcceptanceCriteria.

Load the `effortless-orchestrator` skill first (skills are vendored in
`.claude/skills/`). Then:

- **Change a rule or a screen → edit the rulebook, then `effortless build`.**
  Never hand-edit anything generated. The UI in `app/` is the only hand-written
  code and it contains no business rules: every flag, count, URL and label it
  shows is a derived field read from the rulebook API.
- **The rulebook editor** (`effortless-rulebook-editor`) is the backend:
  `cd effortless-rulebook && bash edit-rulebook.sh` boots Postgres + the
  generated API (http://localhost:42441) + the generated admin portal
  (http://localhost:42442). `GET /api/docs` is the contract. Reads are
  snake_case, writes are PascalCase raw fields only.
- **`app/`** is the Frilly prototype (Vite + React) that talks ONLY to that
  API. `cd app && npm install && npm run dev` → http://localhost:5173.
  Simulated sign-in: pick a persona from the `Personas` table.
- **Conformance suite:** `cd app && npm test` runs one test per
  `UserStories.TestKey` against the live API + app.
- `scripts/import-frilly-scrape.py` was the ONE-TIME content import from the
  live site. After that import the rulebook owns the content; do not re-run it
  to "fix" data — edit the rulebook.

Token discipline: never read the whole rulebook (it holds ~1,500 rows). Query
it: `python3 -c "import json;d=json.load(open('effortless-rulebook/effortless-rulebook.json'));print([k for k in d if not k.startswith('_')])"`.
