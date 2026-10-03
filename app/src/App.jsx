import React, { useEffect, useState, createContext, useContext } from 'react';
import { Routes, Route, Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import * as api from './api.js';
import Home from './screens/Home.jsx';
import Directory from './screens/Directory.jsx';
import ListingDetail from './screens/ListingDetail.jsx';
import Events from './screens/Events.jsx';
import EventDetail from './screens/EventDetail.jsx';
import Login from './screens/Login.jsx';
import AdminDashboard from './screens/AdminDashboard.jsx';
import AdminListings from './screens/AdminListings.jsx';
import AdminListingEdit from './screens/AdminListingEdit.jsx';
import AdminEvents from './screens/AdminEvents.jsx';
import AdminCategories from './screens/AdminCategories.jsx';
import AdminStories from './screens/AdminStories.jsx';
import AdminSettings from './screens/AdminSettings.jsx';

// Component keys referenced by the Routes table. Adding a screen is: add a
// Routes row in the rulebook, build, then (only if it should render) add it here.
const COMPONENTS = {
  Home, Directory, ListingDetail, Events, EventDetail, Login,
  AdminDashboard, AdminListings, AdminListingEdit, AdminEvents, AdminCategories, AdminStories, AdminSettings,
};

const SessionCtx = createContext(null);
export const useSession = () => useContext(SessionCtx);

const SESSION_KEY = 'frilly.persona';
function readSession() { try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; } }

export default function App() {
  const [site, setSite] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [personaId, setPersonaId] = useState(readSession());
  const [error, setError] = useState('');
  const location = useLocation();

  // The navigation IS the Routes table. Refetched on focus so a rulebook edit
  // made elsewhere shows up without a hard reload (no caching, by design).
  const load = () => Promise.all([api.rows('Sites'), api.rows('Routes'), api.rows('Personas')])
    .then(([s, r, p]) => { setSite(s[0]); setRoutes(r.sort((a, b) => a.sort_order - b.sort_order)); setPersonas(p); setError(''); })
    .catch((e) => setError(e.message));
  useEffect(() => { load(); const f = () => document.visibilityState === 'visible' && load(); window.addEventListener('focus', f); document.addEventListener('visibilitychange', f); return () => { window.removeEventListener('focus', f); document.removeEventListener('visibilitychange', f); }; }, []);

  const persona = personas.find((p) => p.persona_id === personaId) || null;
  const signIn = (id) => { try { localStorage.setItem(SESSION_KEY, id); } catch {} setPersonaId(id); };
  const signOut = () => { try { localStorage.removeItem(SESSION_KEY); } catch {} setPersonaId(''); };

  if (error) return <div className="wrap"><div className="err" style={{ marginTop: 40 }}>Cannot reach the rulebook API at <code>{api.API}</code>: {error}. Start it with <code>bash effortless-rulebook/edit-rulebook.sh</code>.</div></div>;
  if (!site) return <div className="wrap"><p className="note" style={{ marginTop: 40 }}>Loading…</p></div>;

  const publicNav = routes.filter((r) => r.area === 'public' && r.show_in_nav);
  const adminNav = routes.filter((r) => r.area === 'admin' && r.show_in_nav);
  const inAdmin = location.pathname.startsWith('/admin');
  const cityHref = (pattern) => pattern.replace(':state', 'wisconsin').replace(':city', 'madison');

  return (
    <SessionCtx.Provider value={{ persona, personas, signIn, signOut, site, routes }}>
      <header className="hdr">
        <div className="wrap">
          <Link className="brand" to="/">{site.title}</Link>
          <nav className="nav">
            {publicNav.filter((r) => r.route_id !== 'login').map((r) => (
              <NavLink key={r.route_id} to={cityHref(r.pattern)} end={r.pattern === '/'}>{r.label}</NavLink>
            ))}
            <a href={site.vision_url} target="_blank" rel="noreferrer">Vision</a>
            {persona?.is_admin && <NavLink to="/admin">Admin</NavLink>}
            {persona ? (
              <button className="btn ghost sm" onClick={signOut} data-testid="signout">Sign out ({persona.display_name})</button>
            ) : (
              <Link className="btn lime" to="/login" data-testid="join">Join Now</Link>
            )}
          </nav>
        </div>
      </header>

      {inAdmin ? (
        <div className="wrap admin">
          <aside className="side">
            <div className="who">Signed in as <b>{persona?.display_name || 'nobody'}</b></div>
            {adminNav.map((r) => <NavLink key={r.route_id} to={r.pattern} end={r.pattern === '/admin'}>{r.label}</NavLink>)}
          </aside>
          <main><RouteTable routes={routes} personaOk={!!persona?.is_admin} /></main>
        </div>
      ) : (
        <main><RouteTable routes={routes} personaOk={!!persona?.is_admin} /></main>
      )}
      <footer>© {new Date().getFullYear()} {site.title} · prototype rebuilt from one rulebook</footer>
    </SessionCtx.Provider>
  );
}

function RouteTable({ routes, personaOk }) {
  return (
    <Routes>
      {routes.map((r) => {
        const C = COMPONENTS[r.component];
        let el;
        if (!r.is_implemented || !C) el = <Placeholder route={r} />;
        else if (r.is_admin_route && !personaOk) el = <Navigate to="/login" replace state={{ from: r.pattern }} />;
        else el = <C route={r} />;
        return <Route key={r.route_id} path={r.pattern} element={el} />;
      })}
      <Route path="*" element={<div className="wrap"><div className="empty">No route in the rulebook matches this address.</div></div>} />
    </Routes>
  );
}

function Placeholder({ route }) {
  return (
    <div className="wrap"><div className="detail">
      <h2>{route.label}</h2>
      <p>{route.description}</p>
      <p className="note">This screen exists as a <code>Routes</code> row (<code>{route.route_id}</code>) with <code>IsImplemented = false</code>. Flip it in the rulebook once a component is mapped.</p>
    </div></div>
  );
}
