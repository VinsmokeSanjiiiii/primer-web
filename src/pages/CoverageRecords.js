import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, ref, get, query, orderByChild, equalTo } from '../firebase';
import { sortCoverageByDateDesc, formatDuration } from '../utils/coverageUtils';

export default function CoverageRecords() {
  const { session } = useAuth();
  const empId = session?.employeeId;
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!empId) return;
    get(query(ref(db, 'CoverageList'), orderByChild('Employee_ID_Number'), equalTo(empId))).then(s => {
      const list = [];
      s.forEach(c => list.push(c.val()));
      sortCoverageByDateDesc(list);
      setItems(list);
    });
  }, [empId]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Coverage Records</h2>
      {items.length===0 && <p className="text-sm text-slate-500">No coverage records found.</p>}
      <div className="space-y-3">
        {items.map((it, i) => (
          <div key={i} className="rounded-xl bg-white p-4 shadow">
            <div className="flex justify-between text-sm font-bold"><span>{it.CoverageDate}</span><span className={it.CoverageStatus==='Completed'?'text-green-600':'text-amber-600'}>{it.CoverageStatus}</span></div>
            <div className="text-xs text-slate-500">{it.CoverageType} • {formatDuration(it.forCoverageHours)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}