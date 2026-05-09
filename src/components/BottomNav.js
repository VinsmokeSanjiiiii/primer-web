import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const items = [
  { path:'/dashboard', label:'Home', icon:'🏠' },
  { path:'/profile', label:'Profile', icon:'👤' },
  { path:'/requests', label:'Requests', icon:'📋' },
  { path:'/attendance', label:'Attendance', icon:'📅' },
];

export default function BottomNav() {
  const loc = useLocation(); const nav = useNavigate();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white pb-safe pt-2">
      <div className="mx-auto flex max-w-3xl justify-around">
        {items.map(it => {
          const active = loc.pathname === it.path;
          return (
            <button key={it.path} onClick={()=>nav(it.path)} className={`flex flex-col items-center px-3 py-1 text-xs ${active?'text-primer-accent font-semibold':'text-slate-500'}`}>
              <span className="text-xl">{it.icon}</span>
              <span>{it.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}