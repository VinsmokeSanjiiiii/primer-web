import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, ref, onValue, off, get, remove, update, query, orderByChild, equalTo } from '../firebase';
import { isFutureDate } from '../utils/dateHelpers';
import Modal from '../components/Modal';

export default function Requests() {
  const { session, user } = useAuth();
  const empId = session?.employeeId;
  const [tab, setTab] = useState('leave');
  const [leaves, setLeaves] = useState([]);
  const [ots, setOts] = useState([]);
  const [cancelModal, setCancelModal] = useState(null);

  useEffect(() => {
    if (!empId) return;
    const r = ref(db, 'LeaveRequests');
    onValue(r, s => {
      const list = [];
      const curYear = new Date().getFullYear();
      s.forEach(c => {
        const d = c.val();
        if (d.Employee_ID_Number===empId && d.status==='Approved') {
          const y = new Date(d.leaveDate).getFullYear();
          if (y===curYear) list.push({ key:c.key, ...d });
        }
      });
      setLeaves(list);
    });
    const o = ref(db, 'OverTime');
    onValue(o, s => {
      const list = [];
      s.forEach(c => { const d=c.val(); if (d.Employee_ID_Number===empId) list.push({ key:c.key, ...d }); });
      setOts(list);
    });
    return () => { off(r); off(o); };
  }, [empId]);

  const promptCancel = (item) => {
    if (!isFutureDate(item.leaveDate)) { alert('You cannot cancel requests on the same day or after the leave date has passed.'); return; }
    setCancelModal(item);
  };

  const doCancel = async (reason) => {
    const item = cancelModal;
    await remove(ref(db, `LeaveRequests/${item.key}`));
    const attSnap = await get(query(ref(db, 'Attendance'), orderByChild('Employee_ID_Number'), equalTo(empId)));
    attSnap.forEach(c => { if (c.val().date_in===item.leaveDate) remove(ref(db, `Attendance/${c.key}`)); });
    const covSnap = await get(query(ref(db, 'CoverageList'), orderByChild('Employee_ID_Number'), equalTo(empId)));
    covSnap.forEach(c => { if (c.val().CoverageDate===item.leaveDate) remove(ref(db, `CoverageList/${c.key}`)); });

    if (item.leaveType==='Sick Leave') await returnCredit('SL_Credits');
    if (item.leaveType==='Vacation Leave') await returnCredit('VL_Credits');
    if (item.leaveType==='Birthday Leave') await returnCredit('BL_Credit');

    alert('Request cancelled and credit returned.');
    setCancelModal(null);
  };

  const returnCredit = async (field) => {
    const cur = parseInt(user?.[field]||0,10);
    await update(ref(db, `Users/${empId}`), { [field]: cur+1 });
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">My Requests</h2>
      <div className="mb-4 flex rounded-lg bg-slate-200 p-1">
        <button onClick={()=>setTab('leave')} className={`flex-1 rounded-md py-2 text-sm font-bold ${tab==='leave'?'bg-primer-accent text-white':'text-slate-600'}`}>Leave</button>
        <button onClick={()=>setTab('ot')} className={`flex-1 rounded-md py-2 text-sm font-bold ${tab==='ot'?'bg-primer-accent text-white':'text-slate-600'}`}>OT</button>
      </div>

      {tab==='leave' && (
        <div className="space-y-3">
          {leaves.map(l => (
            <div key={l.key} className="rounded-xl bg-white p-4 shadow">
              <div className="flex justify-between text-sm font-semibold"><span>{l.leaveType}</span><span className="text-green-600">{l.status}</span></div>
              <div className="text-xs text-slate-500">{l.leaveDate}</div>
              {isFutureDate(l.leaveDate) && (
                <button onClick={()=>promptCancel(l)} className="mt-2 rounded bg-red-100 px-3 py-1 text-xs font-bold text-red-700">Cancel</button>
              )}
            </div>
          ))}
          {leaves.length===0 && <p className="text-sm text-slate-500">No leave requests.</p>}
        </div>
      )}

      {tab==='ot' && (
        <div className="space-y-3">
          {ots.map(o => (
            <div key={o.key} className="rounded-xl bg-white p-4 shadow">
              <div className="flex justify-between text-sm font-semibold"><span>{o.OT_Date}</span><span className="text-amber-600">{o.OT_Status}</span></div>
              <div className="text-xs text-slate-500">{o.OT_Time} Hours</div>
            </div>
          ))}
          {ots.length===0 && <p className="text-sm text-slate-500">No OT requests.</p>}
        </div>
      )}

      <Modal open={!!cancelModal} title="Cancellation Reason" onClose={()=>setCancelModal(null)} actions={
        <div className="w-full">
          <textarea id="cancelReason" className="w-full rounded-lg border p-2 text-sm" placeholder="Please enter your reason." />
          <button onClick={()=>{ const r=document.getElementById('cancelReason').value.trim(); if(!r){alert('Reason cannot be empty.');return;} doCancel(r); }} className="mt-3 w-full rounded-lg bg-red-600 py-2 text-sm font-bold text-white">Submit Cancellation</button>
        </div>
      } />
    </div>
  );
}