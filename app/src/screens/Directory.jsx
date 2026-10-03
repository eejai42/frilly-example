import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import * as api from '../api.js';
import { ListingCard, Loading } from './shared.jsx';

export default function Directory() {
  const { state, city } = useParams();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const type = params.get('type') || '';
  const cat = params.get('cat') || '';
  const [listings, setListings] = useState(null);
  const [types, setTypes] = useState([]);
  const [cats, setCats] = useState([]);
  const [cities, setCities] = useState([]);
  useEffect(() => { api.rows('Listings').then(setListings); api.rows('EntityTypes').then((t) => setTypes(t.sort((a, b) => a.sort_order - b.sort_order))); api.rows('Categories').then(setCats); api.rows('Cities').then(setCities); }, []);

  const theCity = cities.find((c) => c.state_slug === state && c.city_slug === city);
  const prefix = `/${state}/${city}`;
  const set = (k, v) => { const p = new URLSearchParams(params); v ? p.set(k, v) : p.delete(k); setParams(p); };

  const shown = (listings || [])
    .filter((l) => l.is_listable && l.city_path_prefix === prefix)
    .filter((l) => !type || l.entity_type === type)
    .filter((l) => !cat || l.category === cat)
    .filter((l) => !q || String(l.search_text).includes(q.toLowerCase()))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div className="wrap">
      <p className="crumbs">Directory / {theCity ? theCity.name : city}</p>
      <h1>{theCity ? theCity.name : city}</h1>
      {theCity && <p className="note" data-testid="city-counts">{theCity.count_of_businesses} businesses · {theCity.count_of_organizations} organizations · {theCity.count_of_individuals} individual makers · {theCity.count_of_upcoming_events} upcoming events</p>}
      <div className="filters">
        <input className="input" placeholder="Search by name, tag or category" value={q} onChange={(e) => set('q', e.target.value)} data-testid="dir-search" />
        <div className="tabs">
          <button className={!type ? 'on' : ''} onClick={() => set('type', '')}>All</button>
          {types.map((t) => <button key={t.entity_type_id} className={type === t.entity_type_id ? 'on' : ''} onClick={() => set('type', t.entity_type_id)} data-testid={`type-${t.entity_type_id}`}>{t.plural_label}</button>)}
        </div>
        <select value={cat} onChange={(e) => set('cat', e.target.value)} data-testid="dir-category">
          <option value="">All categories</option>
          {cats.filter((c) => c.count_of_listings > 0).sort((a, b) => a.title.localeCompare(b.title)).map((c) => <option key={c.category_id} value={c.category_id}>{c.menu_label}</option>)}
        </select>
      </div>
      {!listings ? <Loading /> : (
        <>
          <p className="note" data-testid="result-count">{shown.length} result{shown.length === 1 ? '' : 's'}</p>
          <div className="grid" data-testid="directory-grid">{shown.slice(0, 200).map((l) => <ListingCard key={l.listing_id} l={l} />)}</div>
          {shown.length > 200 && <p className="note">Showing the first 200. Narrow the search to see the rest.</p>}
        </>
      )}
    </div>
  );
}
