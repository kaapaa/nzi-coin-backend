import React, { useState, useEffect } from 'react';

function Dashboard({ token, role }) {
  const [tools, setTools] = useState([]);
  const [form, setForm] = useState({ name: '', expirationDate: '', purchaseDate: '', serialNumber: '' });

  // Fetch tools
  useEffect(() => {
    fetch('/tools', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(setTools);
  }, [token]);

  // Add tool (teamlead/admin only)
  async function handleAddTool(e) {
    e.preventDefault();
    const res = await fetch('/tools', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setTools([...tools, form]);
      setForm({ name: '', expirationDate: '', purchaseDate: '', serialNumber: '' });
    } else {
      alert('Add tool failed');
    }
  }

  return (
    <div>
      <h2>Dashboard ({role})</h2>
      {(role === 'admin' || role === 'teamlead') && (
        <form onSubmit={handleAddTool}>
          <input placeholder="Tool Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input type="date" placeholder="Expiration Date" value={form.expirationDate} onChange={e => setForm({ ...form, expirationDate: e.target.value })} />
          <input type="date" placeholder="Purchase Date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} />
          <input placeholder="Serial Number" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} />
          <button type="submit">Add Tool</button>
        </form>
      )}
      <ul>
        {tools.map((tool, idx) => (
          <li key={idx}>{tool.name} | Exp: {tool.expirationDate} | Purchased: {tool.purchaseDate} | SN: {tool.serialNumber}</li>
        ))}
      </ul>
    </div>
  );
}

export default Dashboard;