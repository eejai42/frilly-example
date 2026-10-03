import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api.js';
import { EventCard, Loading, byDate } from './shared.jsx';

export default function ListingDetail() {
  const { slug, state, city } = useParams();
  const [l, setL] = useState(null);
  const [events, setEvents] = useState([]);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    setL(null); setMissing(false);
    api.row('Listings', slug).then(setL).catch(() => setMissing(true));
    api.rows('Events').then((rows) => setEvents(rows.filter((e) => e.venue === slug && e.is_listable).sort(byDate)));
  }, [slug]);
  if (missing) return <div className="wrap"><div className="empty">No listing with that address.</div></div>;
  if (!l) return <div className="wrap"><Loading /></div>;
  if (!l.is_listable) return <div className="wrap"><div className="empty">This listing is not published.</div></div>;
  const tags = String(l.tags || '').split(',').filter(Boolean);
  return (
    <div className="wrap">
      <p className="crumbs"><Link to={`/${state}/${city}`}>Directory</Link> / {l.entity_type_label} / {l.title}</p>
      <article className="detail" data-testid="listing-detail">
        <h1>{l.title}</h1>
        <div className="chip teal" data-testid="card-label">{l.card_label}</div>
        {l.has_logo && <p><img src={l.logo_url} alt="" style={{ maxHeight: 120 }} /></p>}
        <p className="desc">{l.description}</p>
        <dl className="kv">
          {l.has_phone && <><dt>Phone</dt><dd data-testid="phone">{l.phone}</dd></>}
          {l.has_email && <><dt>Email</dt><dd><a href={`mailto:${l.email}`}>{l.email}</a></dd></>}
          {l.has_website && <><dt>Website</dt><dd><a href={l.website} target="_blank" rel="noreferrer" data-testid="website">{l.website}</a></dd></>}
          {l.has_address && <><dt>Address</dt><dd data-testid="address">{l.full_address}</dd></>}
          {l.has_coordinates && <><dt>Map</dt><dd><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${l.latitude},${l.longitude}`}>Open in Maps</a></dd></>}
          <dt>Machine-readable</dt><dd><a href={l.json_url} target="_blank" rel="noreferrer">JSON</a> · <a href={l.markdown_url} target="_blank" rel="noreferrer">Markdown</a></dd>
        </dl>
        <div>{tags.map((t) => <span className="chip" key={t}>{t}</span>)}</div>
      </article>
      {l.has_upcoming_events && (
        <section className="block">
          <div className="block-head"><h2>Happening here</h2><span className="note">{l.count_of_upcoming_events} upcoming</span></div>
          <div className="grid events" data-testid="venue-events">{events.map((e) => <EventCard key={e.event_id} e={e} />)}</div>
        </section>
      )}
    </div>
  );
}
