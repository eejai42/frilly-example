import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSession } from '../App.jsx';

// Simulated SaaS sign-in: the personas ARE the rulebook's Personas rows. A real
// identity provider would map a verified email onto one of these rows.
export default function Login() {
  const { personas, signIn } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  return (
    <div className="wrap login">
      <h1>Sign in</h1>
      <p className="note">Pick who you are. This prototype simulates the login step; roles come from the rulebook.</p>
      {personas.map((p) => (
        <div key={p.persona_id} className="card" onClick={() => { signIn(p.persona_id); nav(loc.state?.from && !loc.state.from.includes(':') ? loc.state.from : p.home_path); }} data-testid={`persona-${p.persona_id}`}>
          <h3>{p.title} {p.is_admin && <span className="chip lime">admin</span>}</h3>
          <p className="note">{p.description}</p>
          <p className="note">{p.count_of_routes} screens · {p.count_of_user_stories} stories · {p.build_progress_percent}% built</p>
        </div>
      ))}
    </div>
  );
}
