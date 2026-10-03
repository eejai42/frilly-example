import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api.js';
import { Loading } from './shared.jsx';

// The form is generated from the table contract: every RAW field becomes an
// input, every derived field is shown read-only underneath. Save writes only
// the raw fields that changed, then re-reads so the derived block updates.
const HIDDEN = new Set(['ListingId', 'Site', 'SourceId', 'LastUpdated']);

export default function AdminListingEdit() {
  const { slug } = useParams();
  const [contract, setContract] = useState(null);
  const [row, setRow] = useState(null);
  const [draft, setDraft] = useState({});
  const [flash, setFlash] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const load = async () => { const [c, r] = await Promise.all([api.table('Listings'), api.row('Listings', slug)]); setContract(c); setRow(r); setDraft({}); };
  useEffect(() => { load(); }, [slug]);
  if (!contract || !row) return <Loading />;

  const snake = (n) => n.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  const rawFields = contract.fields.filter((f) => (f.type === 'raw' || f.type === 'relationship') && !HIDDEN.has(f.name));
  const derived = contract.fields.filter((f) => f.type !== 'raw' && f.type !== 'relationship');
  const val = (f) => (f.name in draft ? draft[f.name] : row[snake(f.name)] ?? '');

  const save = async () => {
    setSaving(true); setErr('');
    const patch = {};
    for (const f of rawFields) if (f.name in draft) patch[f.name] = f.datatype === 'number' || f.datatype === 'integer' ? Number(draft[f.name]) : f.datatype === 'boolean' ? !!draft[f.name] : draft[f.name];
    try { await api.patchRow('Listings', slug, patch); await load(); setFlash(`Saved ${Object.keys(patch).join(', ')}. Derived fields recomputed.`); setTimeout(() => setFlash(''), 3000); }
    catch (e) { setErr(e.message); }
    setSaving(false);
  };

  return (
    <div data-testid="admin-listing-edit">
      <p className="crumbs"><Link to="/admin/listings">Listings</Link> / {row.title} · <Link to={row.entity_path} target="_blank">view public page ↗</Link></p>
      <h1>{row.title}</h1>
      {flash && <div className="flash" data-testid="flash">{flash}</div>}
      {err && <div className="err" data-testid="save-error">{err}</div>}
      <div className="form">
        {rawFields.map((f) => (
          <div key={f.name} className={f.datatype === 'string' && (f.name === 'Description' || f.name === 'Tags') ? 'full' : ''}>
            <label htmlFor={`f-${f.name}`} title={f.Description}>{f.name}{f.type === 'relationship' ? ` (→ ${f.RelatedTo})` : ''}</label>
            {f.datatype === 'boolean' ? (
              <input id={`f-${f.name}`} type="checkbox" checked={!!val(f)} onChange={(e) => setDraft({ ...draft, [f.name]: e.target.checked })} />
            ) : f.name === 'Description' ? (
              <textarea id={`f-${f.name}`} value={val(f)} onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })} />
            ) : (
              <input id={`f-${f.name}`} className="input" data-testid={`field-${f.name}`} value={val(f)} onChange={(e) => setDraft({ ...draft, [f.name]: e.target.value })} />
            )}
            <div className="note">{f.Description}</div>
          </div>
        ))}
        <div className="full"><button className="btn" onClick={save} disabled={saving || !Object.keys(draft).length} data-testid="save">{saving ? 'Saving…' : 'Save changes'}</button> <span className="note">{Object.keys(draft).length} field(s) changed</span></div>
      </div>
      <div className="derived">
        <h3>Derived by the rulebook (read-only)</h3>
        <div className="kv">{derived.map((f) => { const v = row[snake(f.name)]; return <div key={f.name} data-testid={`derived-${f.name}`} data-value={String(v)}><span>{f.name}</span>: {typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v ?? '')}</div>; })}</div>
      </div>
    </div>
  );
}
