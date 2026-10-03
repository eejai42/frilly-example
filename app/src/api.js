// The ONLY data access in the app. Everything is read from the rulebook API's
// vw_* views and written back as PascalCase raw fields. No business rule lives
// here: flags, counts, URLs and labels are derived fields coming off the wire.
// Nothing is cached at module scope on purpose: the schema itself changes when
// the rulebook changes.
export const API = import.meta.env.VITE_API_URL ?? 'http://localhost:42441';

async function http(path, init) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const text = await res.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }
  if (!res.ok) {
    const msg = body?.error || body?.message || res.statusText;
    const err = new Error(`${init?.method || 'GET'} ${path} → ${res.status}: ${msg}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

/** Read a whole table: { table, fields, fkFields, pkField, rows }. */
export const table = (name) => http(`/api/tables/${name}`);

/** Read one row by its logical key. */
export const row = (name, id) => http(`/api/tables/${name}/rows/${encodeURIComponent(id)}`).then((r) => (r && r.row) || r);

/** Write raw fields (PascalCase) on one row; derived fields recompute server-side. */
export const patchRow = (name, id, patch) =>
  http(`/api/tables/${name}/rows/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }).then((r) => (r && r.row) || r);

/** Insert a row (PascalCase raw fields). */
export const insertRow = (name, data) =>
  http(`/api/tables/${name}/rows`, { method: 'POST', body: JSON.stringify(data) });

export const health = () => http('/api/view-health');
export const docs = () => http('/api/docs');
export const rulespeak = () => fetch(`${API}/api/rulespeak`).then((r) => r.text());
export const schema = (name) => http(`/api/rulebook/schema/${name}`);
export const uncommitted = () => http('/api/uncommitted-status');
export const saveChanges = () => http('/api/save-changes', { method: 'POST' });

/** Convenience: rows only. */
export const rows = async (name) => (await table(name)).rows;

export const num = (v) => (v == null || v === '' ? 0 : Number(v));
