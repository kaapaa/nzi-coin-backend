import React, { useState } from 'react';

function LoginPage({ setToken, setRole }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  async function handleLogin(e) {
    e.preventDefault();
    const res = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    if (res.ok) {
      const data = await res.json();
      setToken(data.token);
      setRole(data.role);
    } else {
      alert('Login failed');
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <h2>Login</h2>
      <input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
      <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" />
      <button type="submit">Login</button>
    </form>
  );
}

export default LoginPage;