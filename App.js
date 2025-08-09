import React, { useState } from 'react';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';

function App() {
  const [token, setToken] = useState('');
  const [role, setRole] = useState('');

  if (!token) {
    return <LoginPage setToken={setToken} setRole={setRole} />;
  }

  return <Dashboard token={token} role={role} />;
}

export default App;