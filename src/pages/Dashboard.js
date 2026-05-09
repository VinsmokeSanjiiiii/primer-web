import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, ref, onValue, off, push, set, get, update } from '../firebase';
import Modal from '../components/Modal';
import { formatDateMDY, toManilaTime } from '../utils/timeUtils';
import { parseDaysOff, isDateConsecutive, isTotalConsecutiveDaysValid, isFutureDate, addDays } from '../utils/dateHelpers';

export default function Dashboard() {
  const nav = useNavigate();
  const { session, user } = useAuth();
  const empId = session?.employeeId;
  const [profile, setProfile] = useState(null);
  const [merged, setMerged] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [proofUrl, setProofUrl] = useState('');

  useEffect(() => {
    if (!empId) return;
    const r = ref(db, `Users/${empId}`);
    onValue(r, s => { if (s.exists()) setProfile(s.val()); });
    return () => off(r);
  }, [empId]);

  useEffect(() => {
    get(ref(db, 'Holidays')).then(s => {
      const list = [];
      s.forEach(c => { const d = c.child('HDate').val(); if (d) list.push(d); });
      setHolidays(list);
    });
  }, []);

  useEffect(() => {
    if (!empId) return;
    const leaveRef = ref(db, 'LeaveRequests');
    const covRef = ref(db, 'CoverageList');
    const handler = () => {};
    onValue(leaveRef, snap => {
      const items = [];
      snap.forEach(c => {
        const d = c.val();
        if (d.Employee_ID_Number === empId && (d.status==='Pending'||d.status==='Change Pending')) {
          items.push({ type:'leave', ...d, key:c.key });
        }
      });
      onValue(covRef, csnap => {
        const citems = [];
        csnap.forEach(c => {
          const d = c.val();
          if (d.requesterId === empId && ['For Approval','Ongoing','Completed','Disapproved'].includes(d.CoverageStatus)) {
            citems.push({ type:'coverage', ...d, key:c.key });
          }
        });
        setMerged([...items, ...citems]);
      });
    });
    return () => { off(leaveRef); off(covRef); };
  }, [empId]);

  useEffect(() => {
    if (!empId) return;
    get(ref(db, `Users/${empId}/proofUrl`)).then(s => setProofUrl(s.val()||''));
  }, [empId]);

  const openRequestFlow = () => setModal({ mode:'requestType' });

  const startLeave = (leaveType) => {
    if (leaveType==='Birthday Leave' && (profile?.BL_Credit||0)<=0) { alert('Insufficient Birthday Leave credits.'); return; }
    if (leaveType==='Vacation Leave' && (profile?.VL_Credits||0)<=0) {
      if (!window.confirm('You have insufficient Vacation Leave credits. Do you still want to make a request?')) return;
    }
    if (leaveType==='Sick Leave' && (profile?.SL_Credits||0)<=0) {
      setModal({ mode:'sickConfirm', leaveType });
      return;
    }
    if (leaveType==='Birthday Leave') { setModal({ mode:'leaveCalendar', leaveType, daysCount:1, selected:[] }); return; }
    if (leaveType==='Bereavement Leave') { setModal({ mode:'leaveCalendar', leaveType, daysCount:0, selected:[] }); return; }
    const days = parseInt(window.prompt('Please enter the number of leave days.','1'),10);
    if (!days || days<=0) return;
    if (leaveType==='Vacation Leave' && days > (profile?.VL_Credits||0)) {
      if (!window.confirm('You do not have enough vacation leave credits. Do you still want to proceed?')) return;
    }
    setModal({ mode:'leaveCalendar', leaveType, daysCount:days, selected:[] });
  };

  const isDayOff = (dateStr) => {
    const dow = new Date(dateStr).getDay()||7;
    const off = parseDaysOff(profile?.Days_Off||'');
    return off.includes(dow);
  };

  const isHoliday = (dateStr) => holidays.includes(dateStr);

  const handleDatePick = async (dateStr) => {
    const m = modal; if (!m) return;
    if (isDayOff(dateStr)) { alert('This date is one of your days off and cannot be selected.'); return; }
    if (m.selected.includes(dateStr)) { alert('This date is already selected.'); return; }
    if (isDateConsecutive(m.selected, dateStr)) { alert('Selected dates cannot exceed 3 consecutive days for a single leave request.'); return; }

    const avail = await checkDateAvailable(dateStr);
    if (!avail) { alert('Date is not available.'); return; }

    const next = [...m.selected, dateStr];
    if (next.length < m.daysCount) { setModal({...m, selected:next}); return; }

    const off = parseDaysOff(profile?.Days_Off||'');
    if (!isTotalConsecutiveDaysValid(next.join(','), off)) {
      alert('This request would exceed the maximum of 5 consecutive days off (including your days off).');
      return;
    }
    setModal({ mode:'leaveDetails', leaveType:m.leaveType, dates:next, fullName:profile?.Full_Name||'', reason:'' });
  };

  const checkDateAvailable = async (dateStr) => {
    const snap = await get(ref(db, 'LeaveRequests'));
    let total=0, pos=0, hasMine=false;
    const myPos = profile?.Position||'';
    snap.forEach(c => {
      const d=c.val();
      if (d.leaveDate && d.leaveDate.includes(dateStr) && d.status!=='Cancelled') {
        total++;
        if (d.Position===myPos) pos++;
        if (d.Employee_ID_Number===empId) hasMine=true;
      }
    });
    if (hasMine) { alert('You have already requested a leave on this date.'); return false; }
    if (pos>=5) { alert('Maximum number of people from your position already have leave on this date.'); return false; }
    if (total>=10) { alert('Maximum number of people already have leave on this date.'); return false; }
    return true;
  };

  const sendLeaveRequest = async () => {
    const { leaveType, dates, fullName, reason } = modal;
    if (!fullName.trim()) { alert('Please enter your full name.'); return; }
    if (leaveType!=='Birthday Leave' && !reason.trim()) { alert('Please enter your reason for leave.'); return; }
    if (reason.trim().length<4) { alert('Minimum of 4 letters is needed.'); return; }
    if (/(.)\1/.test(reason)) { alert('Reason contains repetitive letters. Please input a valid reason.'); return; }

    const daysToDeduct = leaveType==='Vacation Leave' ? Math.min(profile?.VL_Credits||0, dates.length) : (leaveType==='Birthday Leave'?1:0);
    for (let i=0;i<dates.length;i++) {
      const leaveDate = dates[i];
      const status = (leaveType==='Vacation Leave' && i<daysToDeduct) ? 'Approved' : 'Pending';
      const reqId = push(ref(db, 'LeaveRequests')).key;
      const d = new Date(leaveDate);
      const monthName = d.toLocaleString('en-US',{month:'long'});
      const payload = {
        requestId:reqId, leaveType, status, timestamp:Date.now(), leaveDate,
        reason: leaveType==='Birthday Leave'?'Birthday Leave/Celebration':reason,
        proofUrl: proofUrl||'No proof URL provided', Full_Name:fullName, days:'',
        Position: profile?.Position||'', year: d.getFullYear(), month: monthName,
        convertedTimestamp: new Date().toLocaleString('en-US'),
        Employee_ID_Number: empId, Days_Off: profile?.Days_Off||'', Schedule: profile?.Schedule||'',
        Phone_Name: profile?.Phone_Name||'', Coverage_Status:'None', Cancellation_Reason:''
      };
      await set(ref(db, `LeaveRequests/${reqId}`), payload);
      if (status==='Approved') await createCoverageRecord(leaveType, leaveDate);
      if (leaveType==='Vacation Leave' || leaveType==='Birthday Leave') await createAttendanceRecord(leaveType, leaveDate);
    }
    if (leaveType==='Vacation Leave') await updateCredit('VL_Credits', daysToDeduct);
    if (leaveType==='Birthday Leave') await updateCredit('BL_Credit', 1);
    alert('Leave request submitted.');
    setModal(null);
  };

  const createCoverageRecord = async (leaveType, leaveDate) => {
    const cid = Array.from({length:14},()=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*26)]).join('');
    const d = new Date(leaveDate);
    const payload = {
      CoverageDate: leaveDate, CoverageID: cid, CoverageStatus:'Available', CoverageTime: profile?.Schedule||'',
      CoverageType: leaveType, CoveredHours:'0', Days_Off: profile?.Days_Off||'', Employee_ID_Number: empId,
      Phone_Name: profile?.Phone_Name||'', Schedule: profile?.Schedule||'', forCoverageHours:'8',
      Position: profile?.Position||'', month: d.toLocaleString('en-US',{month:'long'}), year: String(d.getFullYear()),
      requesterId: empId, requesterName: profile?.Full_Name||'', Team: profile?.Team||''
    };
    await set(ref(db, `CoverageList/${cid}`), payload);
  };

  const createAttendanceRecord = async (leaveType, leaveDate) => {
    const aid = push(ref(db, 'Attendance')).key;
    const d = new Date(leaveDate);
    const status = leaveType==='Vacation Leave'?'Vacation Leave':(leaveType==='Birthday Leave'?'Birthday Leave':'None');
    const payload = {
      ABonus:0, AttendanceID:aid, Employee_ID_Number:empId, Infraction:0, Note:'None',
      Phone_Name: profile?.Phone_Name||'', RHoliday:0, SHoliday:0, Status:status,
      date_in: leaveDate, date_out: leaveDate, isClockedIn:false, mins_late:0,
      month: d.toLocaleString('en-US',{month:'long'}), time_in:' ', time_out:' ',
      total_hours:8, year: d.getFullYear(), recordType:'newType'
    };
    await set(ref(db, `Attendance/${aid}`), payload);
  };

  const updateCredit = async (field, deduct) => {
    const cur = parseInt(profile?.[field]||0,10);
    await update(ref(db, `Users/${empId}`), { [field]: Math.max(0, cur-deduct) });
  };

  const startOT = () => setModal({ mode:'otType' });
  const startTech = () => setModal({ mode:'techDate' });

  const submitOT = async () => {
    const { otType, otDate, fullName, reason, hours, minutes } = form;
    if (!fullName.trim()) { alert('Please enter your full name.'); return; }
    if (!hours) { alert('Please select the OT duration.'); return; }
    if (reason.trim() && reason.trim().length<4) { alert('Minimum of 4 letters is needed.'); return; }
    if (/(.)\1/.test(reason)) { alert('Reason contains repetitive letters.'); return; }

    const cid = Array.from({length:14},()=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*26)]).join('');
    const d = new Date(otDate);
    const typeMap = { 'Pre-Shift':'PREOT', 'Post-Shift':'POSTOT', 'RestDay OverTime':'RDOT' };
    const payload = {
      CoverageStatus:'For Approval', CoverageType: typeMap[otType]||'OT',
      CoverageDate: otDate, CoverageID: cid, CoverageTime: profile?.Schedule||'',
      CoveredHours:'0', Days_Off: profile?.Days_Off||'', Employee_ID_Number: empId,
      Phone_Name: profile?.Phone_Name||'', Schedule: profile?.Schedule||'',
      forCoverageHours: (hours + minutes/60).toFixed(2),
      Position: profile?.Position||'', month: d.toLocaleString('en-US',{month:'long'}), year: String(d.getFullYear()),
      reason: reason||'', requesterId: empId, requesterName: fullName, Team: profile?.Team||''
    };
    await set(ref(db, `CoverageList/${cid}`), payload);
    alert('OT request submitted for approval.');
    setModal(null); setForm({});
  };

  const submitTech = async () => {
    const { techDate, timeRange, hoursLost, reason } = form;
    if (!timeRange||!reason) { alert('All fields are required.'); return; }
    const cid = Array.from({length:14},()=>'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random()*26)]).join('');
    const d = new Date(techDate);
    const payload = {
      CoverageDate: techDate, CoverageID: cid, CoverageStatus:'Available', CoverageTime: timeRange,
      CoverageType:'Tech Issue', CoveredHours:'0', Days_Off: profile?.Days_Off||'',
      Employee_ID_Number: empId, Phone_Name: profile?.Phone_Name||'',
      Schedule: profile?.Schedule||'', forCoverageHours: hoursLost,
      Position: profile?.Position||'', month: d.toLocaleString('en-US',{month:'long'}), year: String(d.getFullYear()),
      reason, requesterId: empId, requesterName: profile?.Full_Name||'', Team: profile?.Team||''
    };
    await set(ref(db, `CoverageList/${cid}`), payload);
    alert('Tech Issue coverage request created.');
    setModal(null); setForm({});
  };

  if (!profile) return <div className="p-6 text-center">Loading profile...</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-primer-800 p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-600">
            {profile.Profile_Image ? <img src={`data:image/jpeg;base64,${profile.Profile_Image}`} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>}
          </div>
          <div>
            <div className="text-lg font-bold">{profile.Full_Name||'Agent'}</div>
            <div className="text-sm text-slate-300">{profile.Role||'N/A'} • {profile.Position||'N/A'}</div>
            <div className="mt-1 text-xs font-semibold" style={{color: profile.isClockedIn?'#22c55e':'#ef4444'}}>{profile.isClockedIn?'Clocked-In':'Clocked-Out'}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-primer-700 p-2"><div className="font-bold text-lg">{profile.SL_Credits||0}</div><div>SL Credits</div></div>
          <div className="rounded-lg bg-primer-700 p-2"><div className="font-bold text-lg">{profile.VL_Credits||0}</div><div>VL Credits</div></div>
          <div className="rounded-lg bg-primer-700 p-2"><div className="font-bold text-lg">{profile.BL_Credit||0}</div><div>BL Credits</div></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button onClick={()=>nav('/clock')} className="rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
          <div className="text-2xl">⏱️</div><div className="mt-1 font-semibold">Clock In/Out</div>
        </button>
        <button onClick={()=>nav('/infractions')} className="rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
          <div className="text-2xl">⚠️</div><div className="mt-1 font-semibold">Infractions</div>
        </button>
        <button onClick={openRequestFlow} className="rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
          <div className="text-2xl">📋</div><div className="mt-1 font-semibold">Request</div>
        </button>
        <button onClick={()=>nav('/coverage')} className="rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
          <div className="text-2xl">🛡️</div><div className="mt-1 font-semibold">Coverage</div>
        </button>
      </div>

      <div className="rounded-xl bg-white p-4 shadow">
        <h3 className="mb-3 font-bold text-slate-800">Pending Requests</h3>
        {merged.length===0 ? <p className="text-sm text-slate-500">No pending requests.</p> : (
          <div className="space-y-2">
            {merged.map((m,i) => (
              <div key={i} className="rounded-lg border p-3 text-sm">
                {m.type==='leave' ? (
                  <div className="flex justify-between"><span>{m.leaveType} ({m.leaveDate})</span><span className="text-xs font-semibold text-amber-600">{m.status}</span></div>
                ) : (
                  <div className="flex justify-between"><span>{m.CoverageType==='PREOT'?'Pre-Shift OT':m.CoverageType==='POSTOT'?'Post-Shift OT':m.CoverageType==='RDOT'?'RestDay OT':m.CoverageType} ({m.CoverageDate})</span><span className="text-xs font-semibold text-amber-600">{m.CoverageStatus}</span></div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Request Type Modal */}
      <Modal open={modal?.mode==='requestType'} title="Select Request Type" onClose={()=>setModal(null)} actions={
        <div className="grid w-full gap-2">
          <button onClick={()=>setModal({mode:'leaveType'})} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">Request Leave</button>
          <button onClick={startOT} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">Request for OverTime</button>
          <button onClick={startTech} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">Tech Issue Coverage</button>
        </div>
      } />

      {/* Leave Type Modal */}
      <Modal open={modal?.mode==='leaveType'} title="Select Leave Type" onClose={()=>setModal(null)} actions={
        <div className="grid w-full gap-2">
          {['Vacation Leave','Sick Leave','Bereavement Leave','Birthday Leave'].map(lt=>(
            <button key={lt} onClick={()=>startLeave(lt)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">{lt}</button>
          ))}
        </div>
      } />

      {/* Leave Calendar Modal */}
      <Modal open={modal?.mode==='leaveCalendar'} title={`Select Dates (${modal?.leaveType})`} onClose={()=>setModal(null)} actions={
        <div className="w-full">
          <p className="mb-2 text-xs text-slate-500">Selected: {modal?.selected?.join(', ')||'None'}</p>
          <input type="date" className="w-full rounded-lg border p-2 text-sm"
            min={modal?.leaveType==='Sick Leave'||modal?.leaveType==='Bereavement Leave' ? formatDateMDY(addDays(new Date(),-7)) : formatDateMDY(addDays(new Date(),15))}
            onChange={e=>e.target.value && handleDatePick(formatDateMDY(e.target.value))} />
        </div>
      } />

      {/* Leave Details Modal */}
      <Modal open={modal?.mode==='leaveDetails'} title="Request Details" onClose={()=>setModal(null)} actions={
        <div className="w-full space-y-3">
          <input className="w-full rounded-lg border p-2 text-sm" placeholder="Full Name" value={modal?.fullName||''} onChange={e=>setModal({...modal, fullName:e.target.value})} />
          <textarea className="w-full rounded-lg border p-2 text-sm" placeholder="Reason" value={modal?.reason||''} onChange={e=>setModal({...modal, reason:e.target.value})} />
          <button onClick={sendLeaveRequest} className="w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Submit Request</button>
        </div>
      } />

      {/* OT Type Modal */}
      <Modal open={modal?.mode==='otType'} title="Select OT Type" onClose={()=>setModal(null)} actions={
        <div className="grid w-full gap-2">
          <button onClick={()=>setModal({mode:'otShift'})} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">OverTime</button>
          <button onClick={()=>{setForm({...form, otType:'RestDay OverTime'}); setModal({mode:'otDate'});}} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">RestDay OverTime</button>
        </div>
      } />

      {/* OT Shift Modal */}
      <Modal open={modal?.mode==='otShift'} title="Select Shift Type" onClose={()=>setModal(null)} actions={
        <div className="grid w-full gap-2">
          {['Pre-Shift','Post-Shift'].map(s=>(
            <button key={s} onClick={()=>{setForm({...form, otType:s}); setModal({mode:'otDate'});}} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">{s}</button>
          ))}
        </div>
      } />

      {/* OT Date Modal */}
      <Modal open={modal?.mode==='otDate'} title="Select OT Date" onClose={()=>setModal(null)} actions={
        <div className="w-full">
          <input type="date" className="w-full rounded-lg border p-2 text-sm" min={formatDateMDY(new Date())}
            onChange={e=>{ if(e.target.value){ setForm({...form, otDate:formatDateMDY(e.target.value)}); setModal({mode:'otDetails'}); } }} />
        </div>
      } />

      {/* OT Details Modal */}
      <Modal open={modal?.mode==='otDetails'} title="OT Details" onClose={()=>setModal(null)} actions={
        <div className="w-full space-y-3">
          <input className="w-full rounded-lg border p-2 text-sm" placeholder="Full Name" value={form.fullName||profile?.Full_Name||''} onChange={e=>setForm({...form, fullName:e.target.value})} />
          <textarea className="w-full rounded-lg border p-2 text-sm" placeholder="Reason" value={form.reason||''} onChange={e=>setForm({...form, reason:e.target.value})} />
          <div className="flex gap-2">
            <input type="number" min={1} max={6} className="w-1/2 rounded-lg border p-2 text-sm" placeholder="Hours" value={form.hours||''} onChange={e=>setForm({...form, hours:parseInt(e.target.value)||0})} />
            <input type="number" min={0} max={59} className="w-1/2 rounded-lg border p-2 text-sm" placeholder="Minutes" value={form.minutes||''} onChange={e=>setForm({...form, minutes:parseInt(e.target.value)||0})} />
          </div>
          <button onClick={submitOT} className="w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Submit OT</button>
        </div>
      } />

      {/* Tech Issue Date Modal */}
      <Modal open={modal?.mode==='techDate'} title="Tech Issue Date" onClose={()=>setModal(null)} actions={
        <div className="w-full">
          <input type="date" className="w-full rounded-lg border p-2 text-sm"
            min={formatDateMDY(addDays(new Date(),-7))} max={formatDateMDY(new Date())}
            onChange={e=>{ if(e.target.value){ setForm({...form, techDate:formatDateMDY(e.target.value)}); setModal({mode:'techDetails'}); } }} />
        </div>
      } />

      {/* Tech Issue Details Modal */}
      <Modal open={modal?.mode==='techDetails'} title="Tech Issue Details" onClose={()=>setModal(null)} actions={
        <div className="w-full space-y-3">
          <input className="w-full rounded-lg border p-2 text-sm" placeholder="Time of Issue (e.g., 9:00-11:00)" value={form.timeRange||''} onChange={e=>setForm({...form, timeRange:e.target.value})} />
          <input type="number" step="0.01" className="w-full rounded-lg border p-2 text-sm" placeholder="Hours Lost" value={form.hoursLost||''} onChange={e=>setForm({...form, hoursLost:e.target.value})} />
          <textarea className="w-full rounded-lg border p-2 text-sm" placeholder="Reason" value={form.techReason||''} onChange={e=>setForm({...form, techReason:e.target.value})} />
          <button onClick={()=>submitTech({...form, reason:form.techReason})} className="w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Submit Coverage</button>
        </div>
      } />
    </div>
  );
}