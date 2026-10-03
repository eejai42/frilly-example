import React, { useEffect, useState } from 'react';
import * as api from '../api.js';
import { Loading } from './shared.jsx';

export default function AdminStories() {
  const [personas, setPersonas] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [stories, setStories] = useState([]);
  const [acs, setAcs] = useState([]);
  useEffect(() => { api.rows('Personas').then(setPersonas); api.rows('Routes').then(setRoutes); api.rows('UserStories').then(setStories); api.rows('AcceptanceCriteria').then(setAcs); }, []);
  if (!personas) return <Loading />;
  return (
    <div data-testid="admin-stories">
      <h1>Personas, routes and user stories</h1>
      <p className="note">This is the product definition, read from the same rulebook as the content. The conformance suite runs one test per story's TestKey.</p>
      {personas.map((p) => (
        <section key={p.persona_id} style={{ marginBottom: 28 }}>
          <h2>{p.title} <span className="chip teal">{p.count_of_routes} routes</span> <span className="chip">{p.count_of_user_stories} stories</span></h2>
          <div className="pct" style={{ maxWidth: 320 }}><div style={{ width: `${p.build_progress_percent}%` }} /></div>
          <p className="note">{p.build_progress_percent}% of stories built · {p.description}</p>
          <table className="tbl" style={{ marginBottom: 14 }}><thead><tr><th>Route</th><th>Pattern</th><th>Implemented</th><th>Stories</th></tr></thead>
            <tbody>{routes.filter((r) => r.persona === p.persona_id).sort((a, b) => a.sort_order - b.sort_order).map((r) => (
              <tr key={r.route_id}><td>{r.nav_label}</td><td><code>{r.pattern}</code></td><td>{r.is_implemented ? 'yes' : 'no'}</td><td>{r.count_of_user_stories}{!r.is_covered && <span className="chip red">uncovered</span>}</td></tr>
            ))}</tbody></table>
          {stories.filter((s) => s.persona === p.persona_id).sort((a, b) => a.user_story_id.localeCompare(b.user_story_id)).map((s) => (
            <div className="story" key={s.user_story_id} data-testid="story" data-id={s.user_story_id}>
              <b>{s.user_story_id}</b> · {s.statement} <span className={`chip ${s.is_built ? 'lime' : 'gray'}`}>{s.status}</span> {s.is_must_have && <span className="chip">must</span>} <code>{s.route_pattern}</code>
              <ul>{acs.filter((a) => a.user_story === s.user_story_id).sort((a, b) => a.sort_order - b.sort_order).map((a) => <li key={a.acceptance_criterion_id}>{a.statement}</li>)}</ul>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
