import React, { useEffect, useState } from 'react';
import * as api from '../api.js';
import { Loading } from './shared.jsx';

export default function AdminSettings() {
  const [site, setSite] = useState(null);
  const [draft, setDraft] = useState({});
  const [flash, setFlash] = useState('');
  const [err, setErr] = useState('');
  const load = () => api.rows('Sites').then((s) => { setSite(s[0]); setDraft({}); });
  useEffect(() => { load(); }, []);
  if (!site) return <Loading />;
  const fields = [['Title', 'title'], ['Tagline', 'tagline'], ['BaseUrl', 'base_url'], ['Today', 'today'], ['FeaturedLimit', 'featured_limit'], ['JoinUrl', 'join_url'], ['VisionUrl', 'vision_url']];
  const val = (k, s) => (k in draft ? draft[k] : k === 'Today' ? String(site[s] || '').slice(0, 10) : site[s] ?? '');
  const save = async () => {
    setErr('');
    const patch = {}; for (const [k] of fields) if (k in draft) patch[k] = k === 'FeaturedLimit' ? Number(draft[k]) : draft[k];
    try { await api.patchRow('Sites', site.site_id, patch); await load(); setFlash('Saved. Every lookup of these settings recomputed.'); setTimeout(() => setFlash(''), 3000); } catch (e) { setErr(e.message); }
  };
  return (
    <div data-testid="admin-settings">
      <h1>Site settings</h1>
      <p className="note">One row in <code>Sites</code>. Change <b>Today</b> and every event's upcoming flag, every venue's upcoming count and the home page follow.</p>
      {flash && <div className="flash" data-testid="flash">{flash}</div>}
      {err && <div className="err">{err}</div>}
      <div className="form">
        {fields.map(([k, s]) => (
          <div key={k}><label htmlFor={`s-${k}`}>{k}</label><input id={`s-${k}`} className="input" data-testid={`setting-${k}`} value={val(k, s)} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></div>
        ))}
        <div className="full"><button className="btn" onClick={save} disabled={!Object.keys(draft).length} data-testid="save-settings">Save</button></div>
      </div>
      <div className="derived"><h3>Derived</h3><div className="kv">
        <div><span>Headline</span>: {site.headline}</div>
        <div><span>CountOfListings</span>: {site.count_of_listings}</div>
        <div><span>CountOfPublishedListings</span>: {site.count_of_published_listings}</div>
        <div><span>CountOfUpcomingEvents</span>: <b data-testid="upcoming-count">{site.count_of_upcoming_events}</b></div>
        <div><span>CountOfCities</span>: {site.count_of_cities}</div>
        <div><span>IsLive</span>: {String(site.is_live)}</div>
      </div></div>
    </div>
  );
}
