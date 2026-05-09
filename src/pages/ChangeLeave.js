import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, ref, onValue, off, update } from '../firebase';
import { formatDateMDY } from '../utils/timeUtils';
import Modal from '../components/Modal';

export default function ChangeLeave() {
  const { session } = useAuth();
  const empId = session?.employeeId;
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    if (!empId) return;
    const items = [];
    const lr = ref(db, 'LeaveRequests');
    onValue(lr, s => {
      s.forEach(c => {
        const d = c.val();
        if (d.Employee_ID_Number===empId && (d.status==='Approved'||d.status==='Declined')) items.push({ key:c.key, ...d });
      });
      const or = ref(db, 'OTRequests');
      onValue(or, os => {
        os.forEach(c => {
          const d = c.val();
          if (d.Employee_ID_Number===empId && (d.status==='Approved'||d.status==='Declined')) items.push({ key:c.key, type:'ot', ...d });
        });
        setRequests(items);
      });
    });
    return () => { off(lr); off(ref(db,'OTRequests')); };
  }, [empId]);

  const doChange = async (newDate) => {
    if (!selected) return;
    const node = selected.type==='ot' ? 'OTRequests' : 'LeaveRequests';
    await update(ref(db, `${node}/${selected.key}`), { status:'Change Pending', leaveDate: formatDateMDY(newDate) });
    alert('Request date change submitted.');
    setSelected(null);
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Change Leave / OT Date</h2>
      {requests.length===0 && <p className="text-sm text-slate-500">No requests available.</p>}
      <div className="space-y-3">
        {requests.map(r => (
          <button key={r.key} onClick={()=>setSelected(r)} className="w-full rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
            <div className="text-sm font-bold">{r.leaveType||r.otType||'Request'} | {r.leaveDate||r.otDate}</div>
            <div className="text-xs text-slate-500">Status: {r.status}</div>
          </button>
        ))}
      </div>

      <Modal open={!!selected} title="Select New Date" onClose={()=>setSelected(null)} actions={
        <div className="w-full">
          <input type="date" id="newLeaveDate" className="w-full rounded-lg border p-2 text-sm" />
          <button onClick={()=>{ const v=document.getElementById('newLeaveDate').value; if(v) doChange(v); }} className="mt-3 w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Submit Change</button>
        </div>
      } />
    </div>
  );
}