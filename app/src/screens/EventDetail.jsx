import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api.js';
import { Loading, fmtDate } from './shared.jsx';

export default function EventDetail() {
  const { slug, state, city } = useParams();
  const [e, setE] = useState(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { setE(null); api.row('Events', slug).then(setE).catch(() => setMissing(true)); }, [slug]);
  if (missing) return <div className="wrap"><div className="empty">No event with that address.</div></div>;
  if (!e) return <div className="wrap"><Loading /></div>;
  return (
    <div className="wrap">
      <p className="crumbs"><Link to={`/${state}/${city}/events`}>Events</Link> / {e.title}</p>
      <article className="detail" data-testid="event-detail">
        {e.is_cancelled && <div className="chip red">Cancelled</div>}
        {e.is_past && <div className="chip gray">Past event</div>}
        <h1>{e.title}</h1>
        <p><b data-testid="event-date">{fmtDate(e.event_date)}</b> · {e.when_label}</p>
        <p>Price: <b data-testid="event-price">{e.price_label}</b> {e.is_free && <span className="chip lime">Free</span>}</p>
        {e.has_image && <p><img src={e.image_url} alt="" style={{ maxWidth: '100%', borderRadius: 12 }} /></p>}
        <p className="desc">{e.description}</p>
        <dl className="kv">
          <dt>Hosted by</dt><dd><Link to={e.venue_entity_path} data-testid="venue-link">{e.venue_title}</Link></dd>
          <dt>Where</dt><dd data-testid="venue-address">{e.venue_address}</dd>
          {e.keywords && <><dt>Type</dt><dd>{e.keywords}</dd></>}
          {e.genres && <><dt>Genres</dt><dd>{e.genres}</dd></>}
          {e.source_url && <><dt>Tickets / source</dt><dd><a href={e.source_url} target="_blank" rel="noreferrer" data-testid="source-link">{e.source_url}</a></dd></>}
        </dl>
      </article>
    </div>
  );
}
