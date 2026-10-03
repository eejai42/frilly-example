import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api.js';
import { Loading } from './shared.jsx';

export default function AdminCategories() {
  const [cats, setCats] = useState(null);
  const [subs, setSubs] = useState([]);
  useEffect(() => { api.rows('Categories').then(setCats); api.rows('Subcategories').then(setSubs); }, []);
  if (!cats) return <Loading />;
  return (
    <div data-testid="admin-categories">
      <h1>Categories</h1>
      <p className="note">Counts are aggregations in the rulebook; "popular" and "empty" are rules, not UI logic.</p>
      {cats.sort((a, b) => b.count_of_listings - a.count_of_listings).map((c) => (
        <div className="story" key={c.category_id} data-testid="category" data-id={c.category_id}>
          <h3>{c.title} <span className="chip teal">{c.count_of_listings} listings</span> <span className="chip">{c.count_of_subcategories} subcategories</span> {c.is_popular && <span className="chip lime">popular</span>}</h3>
          <div>{subs.filter((s) => s.category === c.category_id).sort((a, b) => b.count_of_listings - a.count_of_listings).map((s) => (
            <Link key={s.subcategory_id} className={`chip ${s.is_empty ? 'gray' : ''}`} to={`/wisconsin/madison?cat=${c.category_id}`}>{s.title} · {s.count_of_listings}</Link>
          ))}</div>
        </div>
      ))}
    </div>
  );
}
