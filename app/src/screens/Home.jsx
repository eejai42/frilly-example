import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as api from '../api.js';
import { useSession } from '../App.jsx';
import { ListingCard, EventCard, Loading, byDate } from './shared.jsx';

export default function Home() {
  const { site } = useSession();
  const [listings, setListings] = useState(null);
  const [events, setEvents] = useState(null);
  const [q, setQ] = useState('');
  const nav = useNavigate();
  useEffect(() => { api.rows('Listings').then(setListings); api.rows('Events').then(setEvents); }, []);

  // Which listings are featured and which events are upcoming is decided by the
  // rulebook (is_featured_live, is_listable). The UI only filters on the flag.
  const featured = (listings || []).filter((l) => l.is_featured_live).slice(0, site.featured_limit);
  const week = (events || []).filter((e) => e.is_listable).sort(byDate).slice(0, 5);

  return (
    <>
      <section className="hero"><div className="wrap">
        <h1>{site.tagline}</h1>
        <p>Discover local businesses, organizations, artists and more in Madison, WI.</p>
        <form className="search" onSubmit={(e) => { e.preventDefault(); nav(`/wisconsin/madison?q=${encodeURIComponent(q)}`); }}>
          <input className="input" placeholder="Search bakeries, venues, makers…" value={q} onChange={(e) => setQ(e.target.value)} data-testid="home-search" />
          <button className="btn lime">Search</button>
        </form>
      </div></section>

      <section className="block"><div className="wrap">
        <div className="block-head"><h2>Featured today</h2><Link to="/wisconsin/madison">Browse the directory →</Link></div>
        {!listings ? <Loading /> : featured.length ? <div className="grid" data-testid="featured">{featured.map((l) => <ListingCard key={l.listing_id} l={l} />)}</div> : <div className="empty">Nothing is featured yet. An admin can feature a complete listing.</div>}
      </div></section>

      <section className="block"><div className="wrap">
        <div className="block-head"><h2>Happening this week</h2><Link to="/wisconsin/madison/events">All events →</Link></div>
        {!events ? <Loading /> : week.length ? <div className="grid events" data-testid="this-week">{week.map((e) => <EventCard key={e.event_id} e={e} />)}</div> : <div className="empty">No upcoming events.</div>}
      </div></section>
    </>
  );
}
