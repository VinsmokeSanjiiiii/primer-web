import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { db, ref, get, query, orderByChild, equalTo, update } from '../firebase';
import { useServerTime } from '../hooks/useServerTime';
import { formatDateMDY } from '../utils/timeUtils';
import Modal from '../components/Modal';

export default function AttendanceRecords() {
  const { session } = useAuth();
  const { nowMs } = useServerTime();
  const empId = session?.employeeId;
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [noteModal, setNoteModal] = useState({ open:false, rec:null, key:'' });

  useEffect(() => {
    const today = new Date();
    const s = `${today.getMonth()+1}/1/${today.getFullYear()}`;
    const e = `${today.getMonth()+1}/${new Date(today.getFullYear(), today.getMonth()+1, 0).getDate()}/${today.getFullYear()}`;
    setStart(s); setEnd(e);
    fetchRecords(s, e);
  }, []);

  const fetchRecords = async (s, e) => {
    const snap = await get(query(ref(db, 'Attendance'), orderByChild('Employee_ID_Number'), equalTo(empId)));
    const list = []; let sum = 0;
    snap.forEach(c => {
      const d = c.val();
      if (d.recordType==='newType') return;
      const di = d.date_in;
      if (di && within(di, s, e)) {
        list.push({ key:c.key, ...d });
        sum += (d.total_hours||0);
      }
    });
    setRecords(list);
    setTotal(Math.round(sum*100)/100);
  };

  const within = (date, s, e) => {
    const a=new Date(date), b=new Date(s), c=new Date(e);
    a.setHours(0,0,0,0); b.setHours(0,0,0,0); c.setHours(0,0,0,0);
    return a>=b && a<=c;
  };

  const openNote = async (rec) => {
    const serverNow = nowMs();
    const snap = await get(ref(db, `Attendance/${rec.key}`));
    const d = snap.val()||{};
    const locked = (d.clock_out_ts && (serverNow - d.clock_out_ts) >= 6*60*60*1000) || d.note_locked;
    if (locked) { alert(`Note is locked.\n\nNote: ${d.Note||'None'}`); return; }
    if (window.confirm('Do you want to add a note to this record?')) {
      setNoteModal({ open:true, rec:d, key:rec.key });
    }
  };

  const saveNote = async () => {
    const note = document.getElementById('attNote').value;
    const serverNow = nowMs();
    const snap = await get(ref(db, `Attendance/${noteModal.key}`));
    const d = snap.val()||{};
    const locked = (d.clock_out_ts && (serverNow - d.clock_out_ts) >= 6*60*60*1000) || d.note_locked;
    if (locked) { alert('Note is now locked.'); setNoteModal({open:false}); return; }
    await update(ref(db, `Attendance/${noteModal.key}`), { Note: note||'None', note_last_edited_ts: serverNow, note_locked: false });
    setNoteModal({open:false});
    fetchRecords(start, end);
  };

  const buildOptions = () => {
    const opts = [];
    const cur = new Date();
    for (let y=cur.getFullYear(); y>=cur.getFullYear()-1; y--) {
      for (let m=0; m<12; m++) {
        const days = new Date(y,m+1,0).getDate();
        for (let d=1; d<=days; d++) opts.push(`${m+1}/${d}/${y}`);
      }
    }
    return opts;
  };

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Attendance Records</h2>
      <div className="mb-4 flex gap-2">
        <select className="flex-1 rounded-lg border p-2 text-sm" value={start} onChange={e=>setStart(e.target.value)}>{buildOptions().map(o=><option key={o}>{o}</option>)}</select>
        <select className="flex-1 rounded-lg border p-2 text-sm" value={end} onChange={e=>setEnd(e.target.value)}>{buildOptions().map(o=><option key={o}>{o}</option>)}</select>
        <button onClick={()=>fetchRecords(start,end)} className="rounded-lg bg-primer-accent px-3 py-2 text-sm font-bold text-white">Filter</button>
      </div>
      <div className="mb-3 font-semibold text-slate-700">Total Hours: {total}</div>
      <div className="space-y-3">
        {records.map(r => (
          <button key={r.key} onClick={()=>openNote(r)} className="w-full rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
            <div className="flex justify-between text-sm font-semibold"><span>{r.date_in}</span><span>{r.total_hours} hrs</span></div>
            <div className="text-xs text-slate-500">In: {r.time_in} • Out: {r.time_out||'—'}</div>
            {r.Note && r.Note!=='None' && <div className="mt-1 text-xs text-slate-600">Note: {r.Note}</div>}
          </button>
        ))}
        {records.length===0 && <p className="text-sm text-slate-500">No records found.</p>}
      </div>

      <Modal open={noteModal.open} title="Add Note" onClose={()=>setNoteModal({open:false})} actions={
        <div className="w-full">
          <textarea id="attNote" className="w-full rounded-lg border p-2 text-sm" defaultValue={noteModal.rec?.Note||''} />
          <button onClick={saveNote} className="mt-3 w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Save</button>
        </div>
      } />
    </div>
  );
}