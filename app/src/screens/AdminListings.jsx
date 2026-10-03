import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import * as api from '../api.js';
import { Toggle, Loading } from './shared.jsx';

export default function AdminListings() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const filter = params.get('filter') || 'all';
  const [listings, setListings] = useState(null);
  const [flash, setFlash] = useState('');
  const [err, setErr] = useState('');
  const load = () => api.rows('Listings').then(setListings);
  useEffect(() => { load(); }, []);
  const set = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p); };

  const write = async (id, patch, label) => {
    setErr('');
    try { await api.patchRow('Listings', id, patch); await load(); setFlash(`${label} saved; derived fields recomputed.`); setTimeout(() => setFlash(''), 2500); }
    catch (e) { setErr(e.message); }
  };

  const shown = (listings || [])
    .filter((l) => filter === 'all' || (filter === 'unpublished' && !l.is_published) || (filter === 'featured' && l.is_featured) || (filter === 'incomplete' && !l.is_complete) || (filter === 'venues' && l.is_venue))
    .filter((l) => !q || String(l.search_text).includes(q.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div data-testid="admin-listings">
      <h1>Listings</h1>
      <div className="filters">
        <input className="input" placeholder="Search" value={q} onChange={(e) => set('q', e.target.value)} data-testid="admin-search" />
        <div className="tabs">
          {[['all', 'All'], ['unpublished', 'Unpublished'], ['featured', 'Featured'], ['incomplete', 'Incomplete'], ['venues', 'Venues']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => set('filter', k)} data-testid={`filter-${k}`}>{l}</button>
          ))}
        </div>
        <span className="note" data-testid="admin-count">{shown.length} shown</span>
      </div>
      {flash && <div className="flash" data-testid="flash">{flash}</div>}
      {err && <div className="err">{err}</div>}
      {!listings ? <Loading /> : (
        <table className="tbl" data-testid="admin-table">
          <thead><tr><th>Listing</th><th>Type</th><th>Category</th><th>Complete</th><th>Published</th><th>Featured</th><th>Live on home</th><th>Events</th></tr></thead>
          <tbody>{shown.slice(0, 150).map((l) => (
            <tr key={l.listing_id} data-testid="admin-row" data-id={l.listing_id}>
              <td><Link to={`/admin/listings/${l.listing_id}`}>{l.title}</Link><div className="note">{l.entity_path}</div></td>
              <td>{l.entity_type_label}</td>
              <td>{l.card_label}</td>
              <td>{l.completeness_percent}%{!l.is_featurable && <div className="note">not featurable</div>}</td>
              <td><Toggle on={l.is_published} label="Published" onChange={(v) => write(l.listing_id, { IsPublished: v }, 'Published')} /></td>
              <td><Toggle on={l.is_featured} label="Featured" onChange={(v) => write(l.listing_id, { IsFeatured: v }, 'Featured')} /></td>
              <td data-testid="featured-live">{l.is_featured_live ? <span className="chip lime">yes</span> : <span className="chip gray">no</span>}</td>
              <td>{l.count_of_upcoming_events}/{l.count_of_events}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      {shown.length > 150 && <p className="note">Showing the first 150. Narrow the search to see the rest.</p>}
    </div>
  );
}
