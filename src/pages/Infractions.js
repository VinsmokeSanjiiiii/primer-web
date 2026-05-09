import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, ref, onValue, off } from '../firebase';

export default function Infractions() {
  const { session } = useAuth();
  const empId = session?.employeeId;
  const [list, setList] = useState([]);

  useEffect(() => {
    if (!empId) return;
    const r = ref(db, 'InfractionList');
    onValue(r, s => {
      const items = [];
      s.forEach(c => { const d=c.val(); if (d.Employee_ID_Number===empId) items.push(d); });
      setList(items);
    });
    return () => off(r);
  }, [empId]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Infractions</h2>
      {list.length===0 && <p className="text-sm text-slate-500">No infractions found.</p>}
      <div className="space-y-3">
        {list.map((inf, i) => (
          <div key={i} className="rounded-xl bg-white p-4 shadow">
            <div className="flex justify-between text-sm font-bold"><span>{inf.InfractionType}</span><span className="text-slate-500">{inf.InfractionDate}</span></div>
            <div className="mt-1 text-xs text-slate-600">Lost Minutes: {inf.Lostminutes}</div>
            <div className="mt-1 text-xs text-slate-500">{inf.Notes||'No notes'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}