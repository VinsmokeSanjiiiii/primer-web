import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingOverlay from '../components/LoadingOverlay';

export default function Login() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const submit = async () => {
    setError('');
    if (!isValidEmail(email)) { setError('Invalid email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    if (!navigator.onLine) { setError('No internet connection.'); return; }
    setLoading(true);
    const res = await login(email, password, remember);
    setLoading(false);
    if (res.ok) nav('/dashboard');
    else setError(res.error);
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-primer-900 px-6">
      {loading && <LoadingOverlay message="Logging In..." />}
      <div className="mx-auto w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-2xl font-bold text-slate-800">Primer Login</h1>
        <div className="space-y-4">
          <input type="email" placeholder="Email" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm" value={email} onChange={e=>setEmail(e.target.value)} />
          <div className="relative">
            <input type={show?'text':'password'} placeholder="Password" className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm pr-10" value={password} onChange={e=>setPassword(e.target.value)} />
            <button onClick={()=>setShow(!show)} className="absolute right-3 top-3 text-xs text-slate-500">{show?'Hide':'Show'}</button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)} />
            Remember Me
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button onClick={submit} className="w-full rounded-lg bg-primer-accent py-3 text-sm font-bold text-white hover:bg-blue-600">Login</button>
        </div>
      </div>
    </div>
  );
}