'use client';

import React, { useState } from 'react';

const RUST = '#5C2A1A';
const COPPER_DARK = '#A85F28';
const CREAM = '#FBF0E8';
const BORDER = '#DDD0C4';
const INK = '#1A1A1A';
const MUTED = '#7A6F60';

export default function LoginForm() {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    if (loading || !password) return;
    setLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = '/dashboard';
        return;
      }
      const j = await res.json().catch(() => ({}));
      setErr(j.error || 'Sign in failed');
    } catch {
      setErr('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: CREAM, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: 16 }}>
      <form
        onSubmit={onSubmit}
        style={{
          background: '#fff',
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: '36px 38px',
          width: 'min(420px, 100%)',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: COPPER_DARK, marginBottom: 8 }}>
          Xtressé · Rep Tracker
        </div>
        <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 600, color: RUST, margin: '0 0 6px', fontSize: 26 }}>
          Welcome back
        </h1>
        <div style={{ fontSize: 13, color: MUTED, marginBottom: 24, lineHeight: 1.5 }}>
          Enter your password to view your sales tracker.
        </div>

        <label style={{ display: 'block', fontSize: 12, color: MUTED, marginBottom: 6, letterSpacing: '0.02em' }}>
          Password
        </label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          autoFocus
          autoComplete="current-password"
          disabled={loading}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '11px 12px',
            fontSize: 14,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            background: '#FFF',
            color: INK,
            fontFamily: 'inherit',
            marginBottom: 14,
          }}
        />

        <button
          type="submit"
          disabled={loading || !password}
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '0.04em',
            border: 'none',
            borderRadius: 6,
            background: !password ? '#D8C4B5' : COPPER_DARK,
            color: '#FFF',
            cursor: loading || !password ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        {err ? (
          <div style={{ marginTop: 14, fontSize: 12, color: '#C62828' }}>{err}</div>
        ) : null}

        <div style={{ marginTop: 22, paddingTop: 14, borderTop: `1px solid ${BORDER}`, fontSize: 11, color: '#9C9081', lineHeight: 1.5 }}>
          Forgot your password? Reach out to Sam.
        </div>
      </form>
    </div>
  );
}
