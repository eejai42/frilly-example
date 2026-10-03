import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import * as api from '../api.js';
import { EventCard, Loading, byDate } from './shared.jsx';

export default function Events() {
  const { state, city } = useParams();
  const [events, setEvents] = useState(null);
  const [free, setFree] = useState(false);
  useEffect(() => { api.rows('Events').then(setEvents); }, []);
  const prefix = `/${state}/${city}`;
  const shown = (events || []).filter((e) => e.is_listable && e.city_path_prefix === prefix).filter((e) => !free || e.is_free).sort(byDate);
  return (
    <div className="wrap">
      <p className="crumbs">Events</p>
      <h1>Upcoming events</h1>
      <div className="filters">
        <label><input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} /> Free only</label>
        <span className="note" data-testid="event-count">{shown.length} events</span>
      </div>
      {!events ? <Loading /> : <div className="grid events" data-testid="events-grid">{shown.map((e) => <EventCard key={e.event_id} e={e} />)}</div>}
    </div>
  );
}
