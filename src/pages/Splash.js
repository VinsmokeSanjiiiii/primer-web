import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Splash() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Checking connection...');
  const [retry, setRetry] = useState(false);

  useEffect(() => {
    let frame;
    const go = () => {
      setRetry(false);
      setProgress(0);
      setStatus('Checking connection...');
      let p = 0;
      frame = setInterval(() => {
        p += 2;
        setProgress(p);
        if (p >= 60) {
          const online = navigator.onLine;
          if (!online) { setStatus('No Internet Connection. Tap Retry.'); setRetry(true); clearInterval(frame); }
          else setStatus('Connected. Please wait...');
        }
        if (p >= 100) {
          clearInterval(frame);
          if (navigator.onLine) nav(session ? '/dashboard' : '/login');
          else { setStatus('No Internet Connection. Tap Retry.'); setRetry(true); }
        }
      }, 30);
    };
    go();
    return () => clearInterval(frame);
  }, [nav, session]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-primer-900 px-6 text-white">
      <div className="mb-8 text-4xl font-bold tracking-wider">PRIMER</div>
      <div className="w-full max-w-xs">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
          <div className="h-full bg-primer-accent transition-all" style={{width:`${progress}%`}}></div>
        </div>
        <div className="mt-3 flex justify-between text-xs text-slate-300">
          <span>{status}</span>
          <span>{progress}%</span>
        </div>
      </div>
      {retry && (
        <button onClick={()=>window.location.reload()} className="mt-6 rounded-lg bg-white px-6 py-2 text-sm font-bold text-primer-900">Retry</button>
      )}
    </div>
  );
}