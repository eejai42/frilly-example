// Conformance suite: one test per UserStories.TestKey in the rulebook.
//
// The suite is driven BY the rulebook: it reads UserStories and
// AcceptanceCriteria from the live API, and refuses to pass if any story has
// no test registered here, or any test here has no story. Each test asserts
// the story's acceptance criteria against the API (the same views the UI
// renders) and, where the criterion is about a screen, against the running
// app through Playwright.
//
// Run:  cd app && npm test        (API at $API, app at $APP_URL)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:42441';
const APP = process.env.APP_URL || 'http://localhost:5173';

const j = async (path, init) => {
  const r = await fetch(API + path, { headers: { 'Content-Type': 'application/json' }, ...init });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, body: b };
};
const rows = async (t) => (await j(`/api/tables/${t}`)).body.rows;
const row = async (t, id) => { const b = (await j(`/api/tables/${t}/rows/${encodeURIComponent(id)}`)).body; return b.row || b; };
const patch = (t, id, p) => j(`/api/tables/${t}/rows/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(p) });

// ---------- browser (optional: skipped if Playwright cannot launch) ----------
let browser = null, page = null;
async function ui() {
  if (page) return page;
  const { chromium } = await import('playwright');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium' }).catch(() => chromium.launch());
  page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  return page;
}
async function signIn(persona) { const p = await ui(); await p.goto(`${APP}/login`, { waitUntil: 'networkidle' }); await p.click(`[data-testid=persona-${persona}]`); await p.waitForURL(/.*/); return p; }
async function goto(path) { const p = await ui(); await p.goto(APP + path, { waitUntil: 'networkidle' }); return p; }
after(async () => { if (browser) await browser.close(); });

// ---------- the registry ----------
const TESTS = {};
const story = (key, fn) => { TESTS[key] = fn; };

story('us-01', async () => {
  const site = (await rows('Sites'))[0];
  const listings = await rows('Listings');
  const live = listings.filter((l) => l.is_featured_live);
  assert.ok(live.length > 0, 'at least one listing is featured live');
  for (const l of live) { assert.equal(l.is_published, true); assert.equal(l.is_featured, true); assert.equal(l.is_featurable, true); }
  const hidden = listings.filter((l) => !l.is_published || !l.is_featured);
  for (const l of hidden) assert.equal(l.is_featured_live, false, `${l.listing_id} must not be featured live`);
  const p = await goto('/');
  await p.waitForSelector('[data-testid=featured] [data-testid=listing-card]');
  const ids = await p.$$eval('[data-testid=featured] [data-testid=listing-card]', (els) => els.map((e) => e.dataset.id));
  assert.ok(ids.length <= site.featured_limit, 'respects FeaturedLimit');
  for (const id of ids) assert.ok(live.some((l) => l.listing_id === id), `${id} shown on home is featured live`);
});

story('us-02', async () => {
  const events = await rows('Events');
  const listable = events.filter((e) => e.is_listable);
  assert.ok(listable.length > 0);
  for (const e of events.filter((e) => e.is_past)) assert.equal(e.is_listable, false);
  const p = await goto('/');
  await p.waitForSelector('[data-testid=this-week] [data-testid=event-card]');
  const ids = await p.$$eval('[data-testid=this-week] [data-testid=event-card]', (els) => els.map((e) => e.dataset.id));
  const sorted = [...listable].sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at))).slice(0, ids.length).map((e) => e.event_id);
  assert.deepEqual(ids, sorted, 'soonest first');
  const txt = await p.$eval('[data-testid=this-week] [data-testid=event-card]', (e) => e.textContent);
  assert.match(txt, /Price:/);
});

story('us-03', async () => {
  const city = (await rows('Cities')).find((c) => c.city_id === 'madison-wi');
  const listings = await rows('Listings');
  const pub = listings.filter((l) => l.is_listable && l.city === 'madison-wi');
  assert.equal(city.count_of_businesses, listings.filter((l) => l.city === 'madison-wi' && l.is_business).length);
  const p = await goto('/wisconsin/madison?type=business');
  await p.waitForSelector('[data-testid=result-count]');
  const n = Number((await p.$eval('[data-testid=result-count]', (e) => e.textContent)).match(/\d+/)[0]);
  assert.equal(n, pub.filter((l) => l.is_business).length);
  assert.match(await p.$eval('[data-testid=city-counts]', (e) => e.textContent), new RegExp(`${city.count_of_businesses} businesses`));
});

story('us-04', async () => {
  const listings = await rows('Listings');
  const expect = listings.filter((l) => l.is_listable && l.city === 'madison-wi' && String(l.search_text).includes('bakery')).length;
  assert.ok(expect > 0);
  const p = await goto('/wisconsin/madison?q=bakery');
  await p.waitForSelector('[data-testid=result-count]');
  const n = Number((await p.$eval('[data-testid=result-count]', (e) => e.textContent)).match(/\d+/)[0]);
  assert.equal(n, expect);
});

story('us-05', async () => {
  const l = await row('Listings', 'bloom-bake-shop');
  assert.equal(l.entity_path, '/wisconsin/madison/b/bloom-bake-shop');
  assert.equal(l.entity_url, 'https://frilly.ai/wisconsin/madison/b/bloom-bake-shop');
  assert.equal(l.card_label, 'Food & Hospitality | Deli & Bakery');
  const p = await goto(l.entity_path);
  await p.waitForSelector('[data-testid=listing-detail]');
  assert.equal(await p.$eval('h1', (e) => e.textContent), l.title);
  assert.equal(await p.$eval('[data-testid=phone]', (e) => e.textContent), l.phone);
  assert.equal(await p.$eval('[data-testid=address]', (e) => e.textContent), l.full_address);
  const venue = (await rows('Listings')).find((x) => x.has_upcoming_events);
  const vp = await goto(venue.entity_path);
  await vp.waitForSelector('[data-testid=venue-events] [data-testid=event-card]');
  const n = await vp.$$eval('[data-testid=venue-events] [data-testid=event-card]', (els) => els.length);
  assert.equal(n, venue.count_of_upcoming_events);
});

story('us-06', async () => {
  const events = await rows('Events');
  const listable = events.filter((e) => e.is_listable && e.city === 'madison-wi');
  const p = await goto('/wisconsin/madison/events');
  await p.waitForSelector('[data-testid=events-grid] [data-testid=event-card]');
  const ids = await p.$$eval('[data-testid=events-grid] [data-testid=event-card]', (els) => els.map((e) => e.dataset.id));
  assert.equal(ids.length, listable.length);
  for (const e of events.filter((e) => e.is_cancelled || e.is_past)) assert.ok(!ids.includes(e.event_id));
});

story('us-07', async () => {
  const e = (await rows('Events')).find((x) => x.is_listable && x.source_url);
  assert.equal(e.event_path, `/wisconsin/madison/events/${e.event_id}`);
  const p = await goto(e.event_path);
  await p.waitForSelector('[data-testid=event-detail]');
  assert.equal(await p.$eval('h1', (x) => x.textContent), e.title);
  assert.equal(await p.$eval('[data-testid=event-price]', (x) => x.textContent), e.price_label);
  assert.equal(await p.$eval('[data-testid=venue-link]', (x) => x.textContent), e.venue_title);
  assert.equal(await p.$eval('[data-testid=venue-address]', (x) => x.textContent), e.venue_address);
  assert.equal(await p.$eval('[data-testid=source-link]', (x) => x.getAttribute('href')), e.source_url);
});

story('us-08', async () => {
  const personas = await rows('Personas');
  const admin = personas.find((p) => p.persona_id === 'admin');
  assert.equal(admin.is_admin, true); assert.equal(admin.home_path, '/admin');
  const p = await ui();
  await p.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await p.click('[data-testid=signout]').catch(() => {});
  await p.goto(`${APP}/admin`, { waitUntil: 'networkidle' });
  assert.match(p.url(), /\/login$/, 'signed-out admin visit redirects to sign in');
  await p.click('[data-testid=persona-admin]');
  await p.waitForSelector('[data-testid=admin-dashboard]', { timeout: 30000 });
  assert.match(p.url(), /\/admin$/);
});

story('us-09', async () => {
  const site = (await rows('Sites'))[0];
  const p = await signIn('admin');
  await p.waitForSelector('[data-testid=tile-listings]', { timeout: 30000 });
  assert.equal(await p.$eval('[data-testid=tile-listings]', (e) => e.textContent), String(site.count_of_listings));
  assert.equal(await p.$eval('[data-testid=tile-published]', (e) => e.textContent), String(site.count_of_published_listings));
  assert.equal(await p.$eval('[data-testid=tile-upcoming-events]', (e) => e.textContent), String(site.count_of_upcoming_events));
  assert.equal(await p.$eval('[data-testid=tile-cities]', (e) => e.textContent), String(site.count_of_cities));
  const incomplete = (await rows('Listings')).filter((l) => l.is_published && !l.is_complete).length;
  assert.equal(await p.$eval('[data-testid=tile-incomplete-listings]', (e) => e.textContent), String(incomplete));
});

story('us-10', async () => {
  const p = await signIn('admin');
  await p.goto(`${APP}/admin/listings?filter=unpublished`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid=admin-count]');
  const unpub = (await rows('Listings')).filter((l) => !l.is_published).length;
  assert.match(await p.$eval('[data-testid=admin-count]', (e) => e.textContent), new RegExp(`^${unpub} shown`));
  await p.goto(`${APP}/admin/listings?q=sylvee`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid=admin-row]');
  const ids = await p.$$eval('[data-testid=admin-row]', (els) => els.map((e) => e.dataset.id));
  assert.ok(ids.includes('the-sylvee'));
});

story('us-11', async () => {
  // featurable listing: flag on -> live on the public strip
  // a complete listing without artwork: give it a logo (raw), feature it, and it goes live
  const l = (await rows('Listings')).find((x) => x.is_listable && x.is_complete && !x.has_logo && !x.is_featured);
  assert.ok(l, 'a complete, not-yet-featured listing exists');
  try {
    let r = await patch('Listings', l.listing_id, { LogoUrl: 'https://example.com/logo.png', IsFeatured: true });
    assert.equal(r.status, 200);
    const after = await row('Listings', l.listing_id);
    assert.equal(after.is_featurable, true);
    assert.equal(after.is_featured_live, true);
  } finally { await patch('Listings', l.listing_id, { LogoUrl: '', IsFeatured: false }); }
  // no logo -> flag on but never live
  const nl = (await rows('Listings')).find((x) => x.is_published && !x.has_logo && !x.is_featured);
  try {
    await patch('Listings', nl.listing_id, { IsFeatured: true });
    const after = await row('Listings', nl.listing_id);
    assert.equal(after.is_featured, true); assert.equal(after.is_featured_live, false);
  } finally { await patch('Listings', nl.listing_id, { IsFeatured: false }); }
});

story('us-12', async () => {
  const before = (await rows('Sites'))[0].count_of_published_listings;
  const l = (await rows('Listings')).find((x) => x.is_published && !x.is_featured && x.count_of_events === 0);
  try {
    await patch('Listings', l.listing_id, { IsPublished: false });
    assert.equal((await row('Listings', l.listing_id)).is_listable, false);
    assert.equal((await rows('Sites'))[0].count_of_published_listings, before - 1);
    const p = await goto(l.entity_path);
    await p.waitForSelector('.empty');
    assert.match(await p.$eval('.empty', (e) => e.textContent), /not published/);
  } finally { await patch('Listings', l.listing_id, { IsPublished: true }); }
  assert.equal((await rows('Sites'))[0].count_of_published_listings, before);
});

story('us-13', async () => {
  const l = (await rows('Listings')).find((x) => !x.has_phone && x.is_published);
  const score = l.completeness_score;
  try {
    const p = await signIn('admin');
    await p.goto(`${APP}/admin/listings/${l.listing_id}`, { waitUntil: 'networkidle' });
    await p.waitForSelector('[data-testid=field-Phone]');
    await p.fill('[data-testid=field-Phone]', '(608) 555-0199');
    await p.click('[data-testid=save]');
    await p.waitForSelector('[data-testid=flash]', { timeout: 30000 });
    await p.waitForFunction(() => document.querySelector('[data-testid=derived-HasPhone]')?.dataset.value === 'true', null, { timeout: 30000 });
    const after = await row('Listings', l.listing_id);
    assert.equal(after.has_phone, true);
    assert.equal(after.completeness_score, score + 1);
    const bad = await patch('Listings', l.listing_id, { HasPhone: false });
    assert.ok(bad.status >= 400, `derived write must be rejected, got ${bad.status}`);
    assert.equal(bad.body.ok, false);
    assert.match(bad.body.error, /not a raw field/);
  } finally { await patch('Listings', l.listing_id, { Phone: '' }); }
  assert.equal((await row('Listings', l.listing_id)).completeness_score, score);
});

story('us-14', async () => {
  const e = (await rows('Events')).find((x) => x.is_listable);
  try {
    await patch('Events', e.event_id, { Status: 'cancelled' });
    const after = await row('Events', e.event_id);
    assert.equal(after.is_cancelled, true); assert.equal(after.is_listable, false);
    const p = await goto('/wisconsin/madison/events');
    await p.waitForSelector('[data-testid=events-grid]');
    const ids = await p.$$eval('[data-testid=events-grid] [data-testid=event-card]', (els) => els.map((x) => x.dataset.id));
    assert.ok(!ids.includes(e.event_id));
  } finally { await patch('Events', e.event_id, { Status: 'scheduled' }); }
  assert.equal((await row('Events', e.event_id)).is_listable, true);
});

story('us-15', async () => {
  const cats = await rows('Categories');
  const subs = await rows('Subcategories');
  const listings = await rows('Listings');
  for (const c of cats.slice(0, 10)) {
    assert.equal(c.count_of_listings, listings.filter((l) => l.category === c.category_id).length);
    assert.equal(c.count_of_subcategories, subs.filter((s) => s.category === c.category_id).length);
  }
  const p = await signIn('admin');
  await p.goto(`${APP}/admin/categories`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid=category]');
  assert.equal(await p.$$eval('[data-testid=category]', (els) => els.length), cats.length);
});

story('us-16', async () => {
  const stories = await rows('UserStories');
  const acs = await rows('AcceptanceCriteria');
  for (const s of stories) {
    assert.match(s.statement, /^As a .+, I want .+ so that .+\.$/);
    assert.equal(s.count_of_acceptance_criteria, acs.filter((a) => a.user_story === s.user_story_id).length);
    assert.equal(s.is_testable, true);
  }
  const p = await signIn('admin');
  await p.goto(`${APP}/admin/stories`, { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid=story]');
  assert.equal(await p.$$eval('[data-testid=story]', (els) => els.length), stories.length);
});

story('us-17', async () => {
  const site = (await rows('Sites'))[0];
  const today = String(site.today).slice(0, 10);
  const before = site.count_of_upcoming_events;
  try {
    await patch('Sites', site.site_id, { Today: '2099-01-01' });
    const after = (await rows('Sites'))[0];
    assert.equal(after.count_of_upcoming_events, 0, 'moving Today to 2099 makes every event past');
    assert.ok((await rows('Events')).every((e) => e.is_past));
  } finally { await patch('Sites', site.site_id, { Today: today }); }
  assert.equal((await rows('Sites'))[0].count_of_upcoming_events, before);
});

story('us-18', async () => {
  const docs = (await j('/api/docs')).body;
  let raw = 0, derived = 0;
  for (const t of docs.tables) {
    const s = (await j(`/api/tables/${t.name || t}`)).body;
    for (const f of (s.fields || [])) (f.type === 'raw' || f.type === 'relationship') ? raw++ : derived++;
  }
  const pct = Math.round((derived / (raw + derived)) * 100);
  assert.ok(pct >= 50, `derived share is ${pct}%`);
  const p = await signIn('admin');
  await p.waitForSelector('[data-testid=derived-ratio]', { timeout: 60000 });
  assert.ok(Number(await p.$eval('[data-testid=derived-ratio]', (e) => e.dataset.pct)) >= 50);
});

// ---------- wire the registry to the rulebook ----------
const stories = await rows('UserStories');
const keys = stories.map((s) => s.test_key);
test('every user story in the rulebook has a conformance test, and vice versa', () => {
  const missing = keys.filter((k) => !TESTS[k]);
  const orphans = Object.keys(TESTS).filter((k) => !keys.includes(k));
  assert.deepEqual(missing, [], 'stories without a test');
  assert.deepEqual(orphans, [], 'tests without a story');
});
test('view health is clean before any story runs', async () => {
  const h = (await j('/api/view-health')).body;
  assert.equal(h.ok, true); assert.equal(h.brokenCount, 0);
});
for (const s of stories.sort((a, b) => a.user_story_id.localeCompare(b.user_story_id))) {
  test(`${s.user_story_id} ${s.title}: ${s.statement}`, { timeout: 120000 }, async () => {
    const fn = TESTS[s.test_key];
    assert.ok(fn, `no test registered for ${s.test_key}`);
    await fn();
  });
}
