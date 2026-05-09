import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, ref, onValue, off, update, remove } from '../firebase';
import Modal from '../components/Modal';

export default function Coverage() {
  const { session, user } = useAuth();
  const empId = session?.employeeId;
  const [all, setAll] = useState([]);
  const [month, setMonth] = useState(String(new Date().getMonth()+1).padStart(2,'0'));
  const [statusFilter, setStatusFilter] = useState('All');
  const [confirmItem, setConfirmItem] = useState(null);

  useEffect(() => {
    const r = ref(db, 'CoverageList');
    onValue(r, s => {
      const list = [];
      s.forEach(c => list.push({ key:c.key, ...c.val() }));
      setAll(list);
    });
    return () => off(r);
  }, []);

  const monthMatch = (dateStr) => {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    return parts[0]===month;
  };

  const available = all.filter(i => i.CoverageStatus==='Available' && (month==='All'||monthMatch(i.CoverageDate)));
  const taken = all.filter(i => i.CoverageStatus!=='Available' && (month==='All'||monthMatch(i.CoverageDate)) && (statusFilter==='All'||i.CoverageStatus===statusFilter));

  const takeOver = async (item) => {
    if (item.requesterId===empId) { alert('You cannot take over your own coverage request.'); return; }
    await update(ref(db, `CoverageList/${item.key}`), { CoverageStatus:'Ongoing' });
    alert('Coverage taken.');
    setConfirmItem(null);
  };

  const cancelTaken = async (item) => {
    await update(ref(db, `CoverageList/${item.key}`), { CoverageStatus:'Available' });
    await remove(ref(db, `Coveredby/${item.CoverageID}`));
    alert('Coverage cancelled and restored to Available.');
    setConfirmItem(null);
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Coverage</h2>
      <div className="mb-4 flex gap-2">
        <select className="flex-1 rounded-lg border p-2 text-sm" value={month} onChange={e=>setMonth(e.target.value)}>
          {['All','01','02','03','04','05','06','07','08','09','10','11','12'].map(m=><option key={m} value={m}>{m==='All'?'All Months':m}</option>)}
        </select>
        <select className="flex-1 rounded-lg border p-2 text-sm" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
          {['All','Ongoing','For Approval','Completed','Disapproved'].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>

      <div className="mb-6">
        <h3 className="mb-2 font-semibold text-slate-700">Available Coverage</h3>
        {available.length===0 && <p className="text-sm text-slate-500">None available.</p>}
        <div className="space-y-2">
          {available.map(i => (
            <div key={i.key} className="rounded-xl bg-white p-3 shadow">
              <div className="text-sm font-semibold">{i.Position} | {i.CoverageDate} at {i.CoverageTime}</div>
              <div className="text-xs text-slate-500">Hours: {i.forCoverageHours} • Type: {i.CoverageType}</div>
              <button onClick={()=>setConfirmItem({...i, action:'take'})} className="mt-2 text-xs font-bold text-blue-600">Take Over</button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 font-semibold text-slate-700">Taken / Ongoing</h3>
        {taken.length===0 && <p className="text-sm text-slate-500">None.</p>}
        <div className="space-y-2">
          {taken.map(i => (
            <div key={i.key} className="rounded-xl bg-white p-3 shadow">
              <div className="text-sm font-semibold">{i.Position} | {i.CoverageDate} at {i.CoverageTime}</div>
              <div className="text-xs text-slate-500">Hours: {i.forCoverageHours} • Status: <span className="font-bold text-green-600">{i.CoverageStatus}</span></div>
              {i.CoverageStatus==='Ongoing' && (
                <button onClick={()=>setConfirmItem({...i, action:'cancel'})} className="mt-2 text-xs font-bold text-red-600">Cancel</button>
              )}
            </div>
          ))}
        </div>
      </div>

      <Modal open={!!confirmItem} title={confirmItem?.action==='take'?'Confirm Coverage':'Confirm Cancellation'} onClose={()=>setConfirmItem(null)} actions={
        <div className="w-full text-sm">
          <p className="mb-3">Are you sure?</p>
          <div className="flex gap-2">
            <button onClick={()=>confirmItem.action==='take'?takeOver(confirmItem):cancelTaken(confirmItem)} className="rounded-lg bg-primer-accent px-4 py-2 text-sm font-bold text-white">Yes</button>
            <button onClick={()=>setConfirmItem(null)} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold">No</button>
          </div>
        </div>
      } />
    </div>
  );
}