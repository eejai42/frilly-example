import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api.js';
import { Loading, fmtDate, byDate } from './shared.jsx';

export default function AdminEvents() {
  const [events, setEvents] = useState(null);
  const [tab, setTab] = useState('upcoming');
  const [err, setErr] = useState('');
  const load = () => api.rows('Events').then(setEvents);
  useEffect(() => { load(); }, []);
  const setStatus = async (id, Status) => { setErr(''); try { await api.patchRow('Events', id, { Status }); await load(); } catch (e) { setErr(e.message); } };
  const shown = (events || []).filter((e) => tab === 'all' || (tab === 'upcoming' && e.is_upcoming) || (tab === 'past' && e.is_past) || (tab === 'cancelled' && e.is_cancelled)).sort(byDate);
  return (
    <div data-testid="admin-events">
      <h1>Events</h1>
      <div className="filters"><div className="tabs">{['upcoming', 'past', 'cancelled', 'all'].map((k) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)} data-testid={`events-${k}`}>{k}</button>)}</div><span className="note" data-testid="admin-event-count">{shown.length} shown</span></div>
      {err && <div className="err">{err}</div>}
      {!events ? <Loading /> : (
        <table className="tbl"><thead><tr><th>Date</th><th>Event</th><th>Venue</th><th>Price</th><th>Public</th><th>Status</th><th></th></tr></thead>
          <tbody>{shown.slice(0, 150).map((e) => (
            <tr key={e.event_id} data-testid="admin-event-row" data-id={e.event_id}>
              <td>{fmtDate(e.event_date)}</td>
              <td><Link to={e.event_path}>{e.title}</Link><div className="note">{e.when_label}</div></td>
              <td>{e.venue_title}</td>
              <td>{e.price_label}{e.is_free && <span className="chip lime">free</span>}</td>
              <td data-testid="listable">{e.is_listable ? <span className="chip lime">listed</span> : <span className="chip gray">hidden</span>}</td>
              <td>{e.status}</td>
              <td>{e.is_cancelled ? <button className="btn sm ghost" onClick={() => setStatus(e.event_id, 'scheduled')}>Restore</button> : <button className="btn sm danger" onClick={() => setStatus(e.event_id, 'cancelled')} data-testid="cancel">Cancel</button>}</td>
            </tr>
          ))}</tbody></table>
      )}
    </div>
  );
}
