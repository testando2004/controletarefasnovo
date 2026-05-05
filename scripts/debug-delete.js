(async () => {
  try {
    const loginResp = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', senha: 'admin123' }),
    });
    console.log('LOGIN status', loginResp.status);
    const loginText = await loginResp.text();
    console.log('LOGIN body:', loginText);

    let token = null;
    try { token = JSON.parse(loginText).token; } catch {}

    const deleteResp = await fetch('http://localhost:3000/api/departamentos/30', {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' },
    });
    console.log('DELETE status', deleteResp.status);
    const deleteText = await deleteResp.text();
    console.log('DELETE body:', deleteText);
  } catch (e) {
    console.error('ERROR:', e);
    process.exit(1);
  }
})();
