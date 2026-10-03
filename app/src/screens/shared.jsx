import React from 'react';
import { Link } from 'react-router-dom';
import { num } from '../api.js';

export function ListingCard({ l }) {
  return (
    <Link className="card" to={l.entity_path} data-testid="listing-card" data-id={l.listing_id}>
      <div className="img">{l.has_logo ? <img src={l.logo_url} alt="" loading="lazy" /> : <span className="mono">{(l.title || '?')[0]}</span>}</div>
      <div className="body">
        <div className="title">{l.title}</div>
        <div className="sub">{l.subcategory_title}</div>
      </div>
    </Link>
  );
}

export function EventCard({ e }) {
  return (
    <Link className="card event" to={e.event_path} data-testid="event-card" data-id={e.event_id}>
      <div className="when">{fmtDate(e.event_date)}</div>
      <h3 className="title">{e.title}</h3>
      <div className="meta">{e.when_label}</div>
      <div className="price">Price: <b>{e.price_label}</b></div>
      <div className="meta">{e.venue_title}</div>
    </Link>
  );
}

export function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(String(d).slice(0, 10) + 'T12:00:00');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export function Tile({ n, label, tone }) {
  return <div className={`tile ${tone || ''}`}><div className="n" data-testid={`tile-${label.replace(/\W+/g, '-').toLowerCase()}`}>{n}</div><div className="l">{label}</div></div>;
}

export function Toggle({ on, onChange, label }) {
  return <button type="button" className={`toggle ${on ? 'on' : ''}`} aria-label={label} aria-pressed={!!on} onClick={() => onChange(!on)} />;
}

export function Loading() { return <p className="note">Loading…</p>; }

export const byDate = (a, b) => String(a.starts_at).localeCompare(String(b.starts_at));
export const n = num;
