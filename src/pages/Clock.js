import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, ref, onValue, off, get, set, update, push, query, orderByChild, equalTo } from '../firebase';
import { useServerTime } from '../hooks/useServerTime';
import { signedMinutesDiff, formatDateMDY, formatTimeHM, toManilaTime } from '../utils/timeUtils';
import Modal from '../components/Modal';

const TIME_TOLERANCE = 300000;

export default function Clock() {
  const nav = useNavigate();
  const { session, user } = useAuth();
  const { nowMs, toManilaMs } = useServerTime();
  const empId = session?.employeeId;
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [lastIn, setLastIn] = useState('');
  const [recordKey, setRecordKey] = useState('');
  const [schedule, setSchedule] = useState('');
  const [noteModal, setNoteModal] = useState(false);

  useEffect(() => {
    if (!empId) return;
    const r = ref(db, `Users/${empId}`);
    onValue(r, s => {
      const d = s.val()||{};
      setIsClockedIn(!!d.isClockedIn);
      setSchedule(d.Schedule||'');
    });
    const attRef = ref(db, 'Attendance');
    get(query(attRef, orderByChild('Employee_ID_Number'), equalTo(empId))).then(snap => {
      snap.forEach(c => {
        const d = c.val();
        if (d.isClockedIn) { setRecordKey(c.key); setLastIn(d.time_in||''); }
      });
    });
    return () => off(r);
  }, [empId]);

  const handleAction = () => {
    const msg = isClockedIn ? 'Are you sure you want to clock out?' : 'Are you sure you want to clock in?';
    if (!window.confirm(msg)) return;
    const serverNow = toManilaMs(nowMs());
    const deviceNow = Date.now();
    if (Math.abs(deviceNow - serverNow) > TIME_TOLERANCE) {
      alert('Device time is incorrect. Please sync your device time.'); return;
    }
    if (isClockedIn) processClockOut(serverNow); else processClockIn(serverNow);
  };

  const processClockIn = async (serverNow) => {
    if (!schedule) { alert('Error: Schedule not available.'); return; }
    const parts = schedule.split('-');
    if (parts.length!==2) { alert('Error: Invalid Schedule format.'); return; }
    const schedIn = parts[0].trim();
    const timeStr = formatTimeHM(serverNow);
    const dateStr = formatDateMDY(serverNow);
    const minsLate = Math.max(signedMinutesDiff(schedIn, timeStr), 0);
    const monthName = new Date(serverNow).toLocaleString('en-US',{month:'long'});
    const year = new Date(serverNow).getFullYear();
    const attId = push(ref(db, 'Attendance')).key;
    const payload = {
      date_in: dateStr, time_in: timeStr, month: monthName, year: String(year),
      isClockedIn: true, time_out: '', date_out: '', Employee_ID_Number: empId,
      Phone_Name: user?.Phone_Name||'', AttendanceID: attId, Infraction: 0, ABonus: 0,
      RHoliday: 0, SHoliday: 0, total_hours: 0.0, mins_late: minsLate, Status: 'None',
      Note: 'None', workSetup: user?.workSetup||'', Team: user?.Team||''
    };
    await set(ref(db, `Attendance/${attId}`), payload);
    await update(ref(db, `Users/${empId}`), { isClockedIn: true });
    setRecordKey(attId); setLastIn(timeStr); setIsClockedIn(true);
    setNoteModal(true);
  };

  const processClockOut = async (serverNow) => {
    if (!recordKey) { alert('No active clock-in record found.'); return; }
    const snap = await get(ref(db, `Attendance/${recordKey}`));
    const d = snap.val()||{};
    const timeInStr = d.time_in; const dateInStr = d.date_in;
    if (!timeInStr || !dateInStr) { alert('Invalid clock-in record.'); return; }
    const clockIn = new Date(`${dateInStr} ${timeInStr}`).getTime();
    const workedMs = serverNow - clockIn;
    const workedHours = Math.round((workedMs/(1000*60*60))*100)/100;
    if (workedHours < 0) { alert('Invalid worked hours calculation.'); return; }

    const timeOut = formatTimeHM(serverNow);
    const dateOut = formatDateMDY(serverNow);
    const upd = { time_out: timeOut, date_out: dateOut, total_hours: workedHours, isClockedIn: false, clock_out_ts: serverNow, note_locked: false, Status: 'None', Note: d.Note||'None' };

    let earlyOut = false; let schedEndMs = -1;
    try {
      const sp = schedule.split(/[-–—]/);
      if (sp.length>=2) {
        const endStr = sp[1].trim();
        const [eh, em] = endStr.split(':').map(Number);
        const endDate = new Date(serverNow);
        endDate.setHours(eh, em||0, 0, 0);
        if (endDate.getTime() < clockIn) endDate.setDate(endDate.getDate()+1);
        schedEndMs = endDate.getTime();
        if ((schedEndMs - serverNow)/(60*1000) > 5) earlyOut = true;
      }
    } catch(e) {}

    if (earlyOut) {
      const minsEarly = Math.round((schedEndMs - serverNow)/(60*1000));
      const hr = Math.floor(minsEarly/60); const mn = minsEarly%60;
      const readable = hr>0 ? `${hr} hours and ${mn} minutes` : `${mn} minutes`;
      if (window.confirm(`You are attempting to clock out ${readable} before your scheduled end time. Would you like to tag this as an Early Out?`)) {
        upd.Status = 'Early Out'; upd.Note = 'Early Out';
      }
    }

    await update(ref(db, `Attendance/${recordKey}`), upd);
    await update(ref(db, `Users/${empId}`), { isClockedIn: false });
    setIsClockedIn(false); setRecordKey(''); setLastIn('');
  };

  const saveNote = async (note) => {
    const serverNow = toManilaMs(nowMs());
    const snap = await get(ref(db, `Attendance/${recordKey}`));
    const d = snap.val()||{};
    const locked = (d.clock_out_ts && (serverNow - d.clock_out_ts) >= 6*60*60*1000) || d.note_locked;
    if (locked) { alert('Note is locked and cannot be modified.'); return; }
    await update(ref(db, `Attendance/${recordKey}`), { Note: note||'None', note_last_edited_ts: serverNow, note_locked: false });
  };

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center">
      <div className={`mb-6 text-2xl font-bold ${isClockedIn?'text-primer-success':'text-primer-danger'}`}>
        {isClockedIn ? `Clocked-In at ${lastIn}` : 'Current Status: Clocked-Out'}
      </div>
      <button onClick={handleAction} className={`mb-4 rounded-full px-10 py-4 text-lg font-bold text-white shadow-lg ${isClockedIn?'bg-red-600 hover:bg-red-700':'bg-green-600 hover:bg-green-700'}`}>
        {isClockedIn ? 'Clock Out' : 'Clock In'}
      </button>
      <button onClick={()=>nav('/attendance')} className="text-sm font-semibold text-primer-accent">View Records</button>

      <Modal open={noteModal} title="Add a Note" onClose={()=>setNoteModal(false)} actions={
        <div className="w-full">
          <textarea id="clockNote" className="w-full rounded-lg border p-2 text-sm" placeholder="Note (optional)" />
          <div className="mt-3 flex gap-2">
            <button onClick={()=>{saveNote(document.getElementById('clockNote').value); setNoteModal(false);}} className="rounded-lg bg-primer-accent px-4 py-2 text-sm font-bold text-white">Save</button>
            <button onClick={()=>setNoteModal(false)} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold">Skip</button>
          </div>
        </div>
      } />
    </div>
  );
}