import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api.js';
import { Tile, Loading } from './shared.jsx';

export default function AdminDashboard() {
  const [site, setSite] = useState(null);
  const [listings, setListings] = useState(null);
  const [cities, setCities] = useState([]);
  const [health, setHealth] = useState(null);
  const [ratio, setRatio] = useState(null);
  useEffect(() => {
    api.rows('Sites').then((s) => setSite(s[0]));
    api.rows('Cities').then(setCities);
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
    // The derived-field ratio is read from the schema the API exposes, not computed from a copy.
    api.table('Listings').then(async (lt) => {
      setListings(lt.rows);
      const d = await api.docs();
      const names = (d.tables || []).map((t) => t.name || t);
      let raw = 0, derived = 0;
      for (const n of names) {
        const s = n === 'Listings' ? lt : await api.table(n).catch(() => null);
        for (const f of (s?.fields || [])) (f.type === 'raw' || f.type === 'relationship') ? raw++ : derived++;
      }
      setRatio({ raw, derived, pct: raw + derived ? Math.round((derived / (raw + derived)) * 100) : 0 });
    }).catch(() => setRatio({ raw: 0, derived: 0, pct: 0 }));
  }, []);
  if (!site || !listings) return <Loading />;
  const incomplete = listings.filter((l) => l.is_published && !l.is_complete);
  const noPhone = listings.filter((l) => !l.has_phone).length;
  const noAddress = listings.filter((l) => !l.has_address).length;
  const featured = listings.filter((l) => l.is_featured_live).length;
  const venues = listings.filter((l) => l.has_upcoming_events).length;
  return (
    <div data-testid="admin-dashboard">
      <h1>Dashboard</h1>
      <p className="note">Every number here is a derived field read from the rulebook views. Nothing is counted in the browser except the quality buckets below, which only filter on flags the rulebook already computed.</p>
      <div className="tiles">
        <Tile n={site.count_of_listings} label="Listings" />
        <Tile n={site.count_of_published_listings} label="Published" tone="lime" />
        <Tile n={site.count_of_upcoming_events} label="Upcoming events" />
        <Tile n={site.count_of_cities} label="Cities" />
        <Tile n={featured} label="Featured live" tone="lime" />
        <Tile n={venues} label="Venues with events" />
      </div>
      <h2>Data quality</h2>
      <div className="tiles">
        <Tile n={incomplete.length} label="Incomplete listings" tone="red" />
        <Tile n={noPhone} label="Missing phone" tone="red" />
        <Tile n={noAddress} label="Missing address" tone="red" />
        <Tile n={ratio ? `${ratio.pct}%` : '…'} label="Derived fields" tone="lime" />
      </div>
      {ratio && <p className="note" data-testid="derived-ratio" data-pct={ratio.pct}>{ratio.derived} of {ratio.raw + ratio.derived} schema fields are lookups, aggregations or formulas. The API's view health is <b>{health?.ok ? 'OK' : 'BROKEN'}</b>.</p>}
      <h2>Cities</h2>
      <table className="tbl"><thead><tr><th>City</th><th>Listings</th><th>Businesses</th><th>Orgs</th><th>Makers</th><th>Upcoming events</th><th>Primary market</th></tr></thead>
        <tbody>{cities.sort((a, b) => b.count_of_listings - a.count_of_listings).slice(0, 12).map((c) => (
          <tr key={c.city_id}><td><Link to={c.path_prefix}>{c.name}</Link></td><td>{c.count_of_listings}</td><td>{c.count_of_businesses}</td><td>{c.count_of_organizations}</td><td>{c.count_of_individuals}</td><td>{c.count_of_upcoming_events}</td><td>{c.is_primary_market ? '★' : ''}</td></tr>
        ))}</tbody></table>
      <h2 style={{ marginTop: 24 }}>Incomplete listings to fix</h2>
      <table className="tbl"><thead><tr><th>Listing</th><th>Score</th><th>Missing</th></tr></thead>
        <tbody>{incomplete.sort((a, b) => a.completeness_score - b.completeness_score).slice(0, 15).map((l) => (
          <tr key={l.listing_id}><td><Link to={`/admin/listings/${l.listing_id}`}>{l.title}</Link></td><td>{l.completeness_percent}%</td>
            <td>{[!l.has_phone && 'phone', !l.has_email && 'email', !l.has_website && 'website', !l.has_address && 'address', !l.has_coordinates && 'map', !l.has_logo && 'logo', !l.has_description && 'description'].filter(Boolean).join(', ')}</td></tr>
        ))}</tbody></table>
    </div>
  );
}
