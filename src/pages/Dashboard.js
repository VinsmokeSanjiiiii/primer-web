import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, ref, onValue, off, get, set, update, push } from '../firebase';
import { formatDateMDY } from '../utils/timeUtils';
import { parseDaysOff, isDateConsecutive, isTotalConsecutiveDaysValid, addDays } from '../utils/dateHelpers';
import Modal from '../components/Modal';
import LoadingOverlay from '../components/LoadingOverlay';

export default function Dashboard() {
  const nav = useNavigate();
  const { session, user } = useAuth();
  const empId = session?.employeeId;
  const [profile, setProfile] = useState(null);
  const [merged, setMerged] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [holidays, setHolidays] = useState([]);
  const [proofUrl, setProofUrl] = useState('');
  const [selectedDates, setSelectedDates] = useState([]);
  const [calendarMode, setCalendarMode] = useState(null); // {leaveType, daysCount, minDate, maxDate}

  // Load profile
  useEffect(() => {
    if (!empId) return;
    const r = ref(db, `Users/${empId}`);
    onValue(r, s => { if (s.exists()) setProfile(s.val()); });
    return () => off(r);
  }, [empId]);

  // Load holidays
  useEffect(() => {
    get(ref(db, 'Holidays')).then(s => {
      const list = [];
      s.forEach(c => { const d = c.child('HDate').val(); if (d) list.push(d); });
      setHolidays(list);
    });
  }, []);

  // Load proofUrl
  useEffect(() => {
    if (!empId) return;
    get(ref(db, `Users/${empId}/proofUrl`)).then(s => setProofUrl(s.val() || ''));
  }, [empId]);

  // Merged pending records listener (LeaveRequests + CoverageList)
  useEffect(() => {
    if (!empId) return;
    const leaveRef = ref(db, 'LeaveRequests');
    const covRef = ref(db, 'CoverageList');
    let unsubLeave, unsubCov;

    const buildMerged = () => {
      get(leaveRef).then(ls => {
        const items = [];
        ls.forEach(c => {
          const d = c.val();
          if (d.Employee_ID_Number === empId && (d.status === 'Pending' || d.status === 'Change Pending')) {
            items.push({ kind: 'leave', key: c.key, ...d });
          }
        });
        get(covRef).then(cs => {
          const citems = [];
          cs.forEach(c => {
            const d = c.val();
            if (d.requesterId === empId && ['For Approval', 'Ongoing', 'Completed', 'Disapproved'].includes(d.CoverageStatus)) {
              citems.push({ kind: 'coverage', key: c.key, ...d });
            }
          });
          setMerged([...items, ...citems]);
        });
      });
    };

    unsubLeave = onValue(leaveRef, buildMerged);
    unsubCov = onValue(covRef, buildMerged);
    return () => { off(leaveRef); off(covRef); };
  }, [empId]);

  // setupLeaveRequestListener equivalent: auto-update vacation credits if approved and credits==0
  useEffect(() => {
    if (!empId) return;
    const r = ref(db, 'LeaveRequests');
    const listener = onValue(r, snap => {
      snap.forEach(c => {
        const d = c.val();
        if (d.Employee_ID_Number === empId && d.leaveType === 'Vacation Leave' && d.status === 'Approved') {
          const credits = parseInt(profile?.VL_Credits || 0, 10);
          if (credits === 0) {
            update(ref(db, `Users/${empId}`), { VL_Credits: 1 });
          }
        }
      });
    });
    return () => off(r, 'value', listener);
  }, [empId, profile?.VL_Credits]);

  const showLoading = (msg) => setLoading(msg || true);
  const hideLoading = () => setLoading(false);

  /* =========================================
     REQUEST FLOW ENTRY
     ========================================= */
  const openRequestFlow = () => setModal({ mode: 'requestType' });

  /* =========================================
     LEAVE REQUEST FLOW
     ========================================= */
  const startLeave = (leaveType) => {
    const sl = parseInt(profile?.SL_Credits || 0, 10);
    const vl = parseInt(profile?.VL_Credits || 0, 10);
    const bl = parseInt(profile?.BL_Credit || 0, 10);

    if (leaveType === 'Vacation Leave' && vl <= 0) {
      if (!window.confirm('You have insufficient Vacation Leave credits. Do you still want to make a request?')) return;
    }
    if (leaveType === 'Birthday Leave' && bl <= 0) {
      alert('Insufficient Birthday Leave credits.'); return;
    }
    if (leaveType === 'Sick Leave' && sl <= 0) {
      setModal({ mode: 'sickConfirm' }); return;
    }

    if (leaveType === 'Birthday Leave') {
      handleBirthdayFlow();
      return;
    }
    if (leaveType === 'Bereavement Leave') {
      openCalendar(leaveType, 0); // 0 = original behavior: proceed after first date
      return;
    }

    const daysStr = window.prompt('Please enter the number of leave days.', '1');
    if (!daysStr) return;
    const daysCount = parseInt(daysStr, 10);
    if (isNaN(daysCount) || daysCount <= 0) { alert('Number of days must be positive.'); return; }
    if (leaveType === 'Vacation Leave' && daysCount > vl) {
      if (!window.confirm('You do not have enough vacation leave credits. Do you still want to proceed with the request?')) return;
    }
    openCalendar(leaveType, daysCount);
  };

  const handleBirthdayFlow = async () => {
    showLoading('Loading birthday info...');
    const snap = await get(ref(db, `Users/${empId}/Birth_date`));
    hideLoading();
    const birthDateStr = snap.val();
    if (!birthDateStr) { alert('Birth date not found on profile.'); return; }

    let birthDate;
    try {
      birthDate = new Date(birthDateStr);
      if (isNaN(birthDate)) throw new Error();
    } catch {
      try {
        const [mdy] = birthDateStr.split(' ');
        birthDate = new Date(mdy);
      } catch { alert('Error parsing birthday date format.'); return; }
    }

    const now = new Date();
    const birthMonth = birthDate.getMonth();
    const birthDay = birthDate.getDate();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    if (currentMonth > birthMonth || (currentMonth === birthMonth && currentDay > birthDay)) {
      alert('Your birthday has already passed for this year. You cannot send a birthday leave request.'); return;
    }

    const birthdayThisYear = new Date(now.getFullYear(), birthMonth, birthDay);
    const diffDays = Math.ceil((birthdayThisYear - now) / (1000 * 60 * 60 * 24));
    if (diffDays < 15) {
      alert('Birthday leave request cannot be made within 15 days of your birthday.'); return;
    }

    const minDate = addDays(now, 15);
    const maxDate = addDays(birthdayThisYear, 7);
    openCalendar('Birthday Leave', 1, minDate, maxDate);
  };

  const openCalendar = (leaveType, daysCount, minDateOverride, maxDateOverride) => {
    const today = new Date();
    let minDate, maxDate;

    if (leaveType === 'Sick Leave' || leaveType === 'Bereavement Leave') {
      minDate = addDays(today, -7);
      maxDate = null;
    } else if (leaveType === 'Vacation Leave' || leaveType === 'Birthday Leave') {
      minDate = minDateOverride || addDays(today, 15);
      maxDate = maxDateOverride || null;
    } else {
      minDate = today;
      maxDate = null;
    }

    setSelectedDates([]);
    setCalendarMode({ leaveType, daysCount, minDate, maxDate });
    setModal({ mode: 'leaveCalendar', leaveType, daysCount });
  };

  const isDayOff = (dateStr) => {
    const dow = new Date(dateStr).getDay() || 7;
    const off = parseDaysOff(profile?.Days_Off || '');
    return off.includes(dow);
  };

  const handleDatePick = async (dateStr) => {
    const cm = calendarMode;
    if (!cm) return;

    if (isDayOff(dateStr)) { alert('This date is one of your days off and cannot be selected.'); return; }
    if (selectedDates.includes(dateStr)) { alert('This date is already selected.'); return; }
    if (isDateConsecutive(selectedDates, dateStr)) { alert('Selected dates cannot exceed 3 consecutive days for a single leave request.'); return; }

    const avail = await checkDateAvailable(dateStr);
    if (!avail) return;

    const next = [...selectedDates, dateStr];

    // For Bereavement (daysCount=0 in original), proceed after first date
    // For others, proceed when count reached
    const proceedNow = cm.daysCount === 0 || next.length >= cm.daysCount;

    if (!proceedNow) {
      setSelectedDates(next);
      alert('Select more dates.');
      return;
    }

    const off = parseDaysOff(profile?.Days_Off || '');
    if (!isTotalConsecutiveDaysValid(next.join(','), off)) {
      alert('This request would exceed the maximum of 5 consecutive days off (including your days off).');
      return;
    }

    setSelectedDates(next);
    setModal({ mode: 'leaveDetails', leaveType: cm.leaveType, dates: next, fullName: profile?.Full_Name || '', reason: '' });
    setCalendarMode(null);
  };

  const checkDateAvailable = async (dateStr) => {
    const snap = await get(ref(db, 'LeaveRequests'));
    let total = 0, pos = 0, hasMine = false;
    const myPos = profile?.Position || '';
    snap.forEach(c => {
      const d = c.val();
      if (d.leaveDate && d.leaveDate.includes(dateStr) && d.status !== 'Cancelled') {
        total++;
        if (d.Position === myPos) pos++;
        if (d.Employee_ID_Number === empId) hasMine = true;
      }
    });
    if (hasMine) { alert('You have already requested a leave on this date. Please try selecting other dates.'); return false; }
    if (pos >= 5) { alert('Maximum number of people from your position already have leave on this date.'); return false; }
    if (total >= 10) { alert('Maximum number of people already have leave on this date.'); return false; }
    return true;
  };

  const sendLeaveRequest = async () => {
    const { leaveType, dates, fullName, reason } = modal;
    if (!fullName.trim()) { alert('Please enter your full name.'); return; }
    if (leaveType !== 'Birthday Leave' && !reason.trim()) { alert('Please enter your reason for leave.'); return; }
    if (reason.trim().length < 4) { alert('Minimum of 4 letters is needed.'); return; }
    if (/(.)\1/.test(reason)) { alert('Reason contains repetitive letters. Please input a valid reason.'); return; }

    showLoading('Sending request... Please wait.');
    const vl = parseInt(profile?.VL_Credits || 0, 10);
    const daysToDeduct = leaveType === 'Vacation Leave' ? Math.min(vl, dates.length) : (leaveType === 'Birthday Leave' ? 1 : 0);

    for (let i = 0; i < dates.length; i++) {
      const leaveDate = dates[i];
      const status = (leaveType === 'Vacation Leave' && i < daysToDeduct) ? 'Approved' : 'Pending';
      const reqId = push(ref(db, 'LeaveRequests')).key;
      const d = new Date(leaveDate);
      const monthName = d.toLocaleString('en-US', { month: 'long' });
      const payload = {
        requestId: reqId, leaveType, status, timestamp: Date.now(), leaveDate,
        reason: leaveType === 'Birthday Leave' ? 'Birthday Leave/Celebration' : reason,
        proofUrl: proofUrl || 'No proof URL provided', Full_Name: fullName, days: '',
        Position: profile?.Position || '', year: d.getFullYear(), month: monthName,
        convertedTimestamp: new Date().toLocaleString('en-US'),
        Employee_ID_Number: empId, Days_Off: profile?.Days_Off || '', Schedule: profile?.Schedule || '',
        Phone_Name: profile?.Phone_Name || '', Coverage_Status: 'None', Cancellation_Reason: ''
      };
      await set(ref(db, `LeaveRequests/${reqId}`), payload);
      if (status === 'Approved') await createCoverageRecord(leaveType, leaveDate);
      if (leaveType === 'Vacation Leave' || leaveType === 'Birthday Leave') {
        await createAttendanceRecord(leaveType, leaveDate);
      }
    }

    if (leaveType === 'Vacation Leave') await updateCredit('VL_Credits', daysToDeduct);
    if (leaveType === 'Birthday Leave') await updateCredit('BL_Credit', 1);
    hideLoading();
    alert('Leave request submitted.');
    setModal(null);
    setSelectedDates([]);
  };

  const createCoverageRecord = async (leaveType, leaveDate) => {
    const cid = Array.from({ length: 14 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('');
    const d = new Date(leaveDate);
    const payload = {
      CoverageDate: leaveDate, CoverageID: cid, CoverageStatus: 'Available', CoverageTime: profile?.Schedule || '',
      CoverageType: leaveType, CoveredHours: '0', Days_Off: profile?.Days_Off || '', Employee_ID_Number: empId,
      Phone_Name: profile?.Phone_Name || '', Schedule: profile?.Schedule || '', forCoverageHours: '8',
      Position: profile?.Position || '', month: d.toLocaleString('en-US', { month: 'long' }), year: String(d.getFullYear()),
      requesterId: empId, requesterName: profile?.Full_Name || '', Team: profile?.Team || ''
    };
    await set(ref(db, `CoverageList/${cid}`), payload);
  };

  const createAttendanceRecord = async (leaveType, leaveDate) => {
    const aid = push(ref(db, 'Attendance')).key;
    const d = new Date(leaveDate);
    const status = leaveType === 'Vacation Leave' ? 'Vacation Leave' : (leaveType === 'Birthday Leave' ? 'Birthday Leave' : 'None');
    const payload = {
      ABonus: 0, AttendanceID: aid, Employee_ID_Number: empId, Infraction: 0, Note: 'None',
      Phone_Name: profile?.Phone_Name || '', RHoliday: 0, SHoliday: 0, Status: status,
      date_in: leaveDate, date_out: leaveDate, isClockedIn: false, mins_late: 0,
      month: d.toLocaleString('en-US', { month: 'long' }), time_in: ' ', time_out: ' ',
      total_hours: 8, year: d.getFullYear(), recordType: 'newType'
    };
    await set(ref(db, `Attendance/${aid}`), payload);
  };

  const updateCredit = async (field, deduct) => {
    const cur = parseInt(profile?.[field] || 0, 10);
    await update(ref(db, `Users/${empId}`), { [field]: Math.max(0, cur - deduct) });
  };

  /* =========================================
     OT REQUEST FLOW
     ========================================= */
  const startOT = () => setModal({ mode: 'otType' });

  const submitOT = async () => {
    const { otType, otDate, fullName, reason, hours, minutes } = form;
    if (!fullName.trim()) { alert('Please enter your full name.'); return; }
    if (!hours || hours < 1 || hours > 6 || (hours === 6 && minutes > 0)) { alert('Please select a valid OT duration (1-6 hours).'); return; }
    if (reason.trim() && reason.trim().length < 4) { alert('Minimum of 4 letters is needed.'); return; }
    if (/(.)\1/.test(reason)) { alert('Reason contains repetitive letters. Please input a valid reason.'); return; }

    showLoading('Sending request... Please wait.');
    const cid = Array.from({ length: 14 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('');
    const d = new Date(otDate);
    const typeMap = { 'Pre-Shift': 'PREOT', 'Post-Shift': 'POSTOT', 'RestDay OverTime': 'RDOT' };
    const payload = {
      CoverageStatus: 'For Approval', CoverageType: typeMap[otType] || 'OT',
      CoverageDate: otDate, CoverageID: cid, CoverageTime: profile?.Schedule || '',
      CoveredHours: '0', Days_Off: profile?.Days_Off || '', Employee_ID_Number: empId,
      Phone_Name: profile?.Phone_Name || '', Schedule: profile?.Schedule || '',
      forCoverageHours: (hours + (minutes || 0) / 60).toFixed(2),
      Position: profile?.Position || '', month: d.toLocaleString('en-US', { month: 'long' }), year: String(d.getFullYear()),
      reason: reason || '', requesterId: empId, requesterName: fullName, Team: profile?.Team || ''
    };
    await set(ref(db, `CoverageList/${cid}`), payload);
    hideLoading();
    alert('OT request submitted for approval.');
    setModal(null); setForm({});
  };

  /* =========================================
     TECH ISSUE FLOW
     ========================================= */
  const startTech = () => setModal({ mode: 'techDate' });

  const submitTech = async () => {
    const { techDate, timeRange, hoursLost, techReason } = form;
    if (!timeRange || !techReason) { alert('All fields are required.'); return; }
    showLoading('Creating coverage request...');
    const cid = Array.from({ length: 14 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)]).join('');
    const d = new Date(techDate);
    const payload = {
      CoverageDate: techDate, CoverageID: cid, CoverageStatus: 'Available', CoverageTime: timeRange,
      CoverageType: 'Tech Issue', CoveredHours: '0', Days_Off: profile?.Days_Off || '',
      Employee_ID_Number: empId, Phone_Name: profile?.Phone_Name || '',
      Schedule: profile?.Schedule || '', forCoverageHours: hoursLost,
      Position: profile?.Position || '', month: d.toLocaleString('en-US', { month: 'long' }), year: String(d.getFullYear()),
      reason: techReason, requesterId: empId, requesterName: profile?.Full_Name || '', Team: profile?.Team || ''
    };
    await set(ref(db, `CoverageList/${cid}`), payload);
    hideLoading();
    alert('Tech Issue coverage request created.');
    setModal(null); setForm({});
  };

  /* =========================================
     RENDER HELPERS
     ========================================= */
  const readableCoverageType = (type) => {
    if (type === 'PREOT') return 'Pre-Shift OT';
    if (type === 'POSTOT') return 'Post-Shift OT';
    if (type === 'RDOT') return 'RestDay OT';
    return type;
  };

  if (!profile) return <div className="p-6 text-center">Loading profile...</div>;

  return (
    <div className="space-y-6">
      {loading && <LoadingOverlay message={typeof loading === 'string' ? loading : 'Loading...'} />}

      {/* Profile Summary Card */}
      <div className="rounded-2xl bg-primer-800 p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-full bg-slate-600">
            {profile.Profile_Image ? (
              <img src={`data:image/jpeg;base64,${profile.Profile_Image}`} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>
            )}
          </div>
          <div>
            <div className="text-lg font-bold">{profile.Full_Name || 'Hello, Agent'}</div>
            <div className="text-sm text-slate-300">{profile.Role || 'N/A'} • {profile.Position || 'N/A'}</div>
            <div className="mt-1 text-xs font-semibold" style={{ color: profile.isClockedIn ? '#22c55e' : '#ef4444' }}>
              {profile.isClockedIn ? 'Clocked-In' : 'Clocked-Out'}
            </div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-lg bg-primer-700 p-2">
            <div className="text-lg font-bold">{profile.SL_Credits || 0}</div><div>SL Credits</div>
          </div>
          <div className="rounded-lg bg-primer-700 p-2">
            <div className="text-lg font-bold">{profile.VL_Credits || 0}</div><div>VL Credits</div>
          </div>
          <div className="rounded-lg bg-primer-700 p-2">
            <div className="text-lg font-bold">{profile.BL_Credit || 0}</div><div>BL Credits</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => nav('/clock')} className="rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
          <div className="text-2xl">⏱️</div><div className="mt-1 font-semibold">Clock In/Out</div>
        </button>
        <button onClick={() => nav('/infractions')} className="rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
          <div className="text-2xl">⚠️</div><div className="mt-1 font-semibold">Infractions</div>
        </button>
        <button onClick={openRequestFlow} className="rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
          <div className="text-2xl">📋</div><div className="mt-1 font-semibold">Request</div>
        </button>
        <button onClick={() => nav('/coverage')} className="rounded-xl bg-white p-4 text-left shadow hover:shadow-md">
          <div className="text-2xl">🛡️</div><div className="mt-1 font-semibold">Coverage</div>
        </button>
      </div>

      {/* Merged Pending Records */}
      <div className="rounded-xl bg-white p-4 shadow">
        <h3 className="mb-3 font-bold text-slate-800">Pending Requests</h3>
        {merged.length === 0 ? (
          <p className="text-sm text-slate-500">No pending requests.</p>
        ) : (
          <div className="space-y-2">
            {merged.map((m, i) => (
              <div key={i} className="rounded-lg border p-3 text-sm">
                {m.kind === 'leave' ? (
                  <div className="flex justify-between">
                    <span>{m.leaveType} ({m.leaveDate})</span>
                    <span className="text-xs font-semibold text-amber-600">{m.status}</span>
                  </div>
                ) : (
                  <div className="flex justify-between">
                    <span>{readableCoverageType(m.CoverageType)} ({m.CoverageDate}) [{m.CoverageStatus}]</span>
                    <span className="text-xs font-semibold text-amber-600">{m.CoverageStatus}</span>
                  </div>
                )}
                {m.kind === 'leave' && (m.leaveType === 'Sick Leave' || m.leaveType === 'Bereavement Leave') && proofUrl && (
                  <div className="mt-1 text-xs">
                    {m.proofAttached ? (
                      <span className="font-semibold text-green-600">Attach a Proof ✔</span>
                    ) : (
                      <a href={proofUrl} target="_blank" rel="noreferrer" className="font-semibold text-yellow-600 underline">Attach a Proof</a>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}

      {/* Request Type */}
      <Modal open={modal?.mode === 'requestType'} title="Select Request Type" onClose={() => setModal(null)} actions={
        <div className="grid w-full gap-2">
          <button onClick={() => setModal({ mode: 'leaveType' })} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">Request Leave</button>
          <button onClick={startOT} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">Request for OverTime</button>
          <button onClick={startTech} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">Tech Issue Coverage</button>
        </div>
      } />

      {/* Leave Type */}
      <Modal open={modal?.mode === 'leaveType'} title="Select Leave Type" onClose={() => setModal(null)} actions={
        <div className="grid w-full gap-2">
          {['Vacation Leave', 'Sick Leave', 'Bereavement Leave', 'Birthday Leave'].map(lt => (
            <button key={lt} onClick={() => startLeave(lt)} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">{lt}</button>
          ))}
        </div>
      } />

      {/* Sick Leave Without Credits Confirm */}
      <Modal open={modal?.mode === 'sickConfirm'} title="Insufficient Credits" onClose={() => setModal(null)} actions={
        <div className="w-full text-sm">
          <p className="mb-3">You have insufficient Sick Leave credits. Do you still want to make a request?</p>
          <div className="flex gap-2">
            <button onClick={() => { setModal(null); openCalendar('Sick Leave', parseInt(window.prompt('Please enter the number of leave days.', '1') || '0', 10)); }} className="rounded-lg bg-primer-accent px-4 py-2 text-sm font-bold text-white">Yes</button>
            <button onClick={() => setModal(null)} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold">No</button>
          </div>
        </div>
      } />

      {/* Leave Calendar */}
      <Modal open={modal?.mode === 'leaveCalendar'} title={`Select Dates (${modal?.leaveType})`} onClose={() => { setModal(null); setCalendarMode(null); }} actions={
        <div className="w-full">
          <p className="mb-2 text-xs text-slate-500">Selected: {selectedDates.join(', ') || 'None'}</p>
          <input
            type="date"
            className="w-full rounded-lg border p-2 text-sm"
            min={calendarMode?.minDate ? formatDateMDY(calendarMode.minDate) : undefined}
            max={calendarMode?.maxDate ? formatDateMDY(calendarMode.maxDate) : undefined}
            onChange={e => e.target.value && handleDatePick(formatDateMDY(new Date(e.target.value + 'T00:00:00')))}
          />
          <p className="mt-2 text-xs text-slate-400">Grayed dates / days off are unavailable. Max 10 people/day, 5 per position.</p>
        </div>
      } />

      {/* Leave Details */}
      <Modal open={modal?.mode === 'leaveDetails'} title="Request Details" onClose={() => setModal(null)} actions={
        <div className="w-full space-y-3">
          <input className="w-full rounded-lg border p-2 text-sm" placeholder="Full Name" value={modal?.fullName || ''} onChange={e => setModal({ ...modal, fullName: e.target.value })} />
          <textarea className="w-full rounded-lg border p-2 text-sm" placeholder={modal?.leaveType === 'Birthday Leave' ? 'Reason (optional)' : 'Reason'} value={modal?.reason || ''} onChange={e => setModal({ ...modal, reason: e.target.value })} />
          <button onClick={sendLeaveRequest} className="w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Submit Request</button>
        </div>
      } />

      {/* OT Type */}
      <Modal open={modal?.mode === 'otType'} title="Select OT Type" onClose={() => setModal(null)} actions={
        <div className="grid w-full gap-2">
          <button onClick={() => setModal({ mode: 'otShift' })} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">OverTime</button>
          <button onClick={() => { setForm({ ...form, otType: 'RestDay OverTime' }); setModal({ mode: 'otDate' }); }} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">RestDay OverTime</button>
        </div>
      } />

      {/* OT Shift */}
      <Modal open={modal?.mode === 'otShift'} title="Select Shift Type" onClose={() => setModal(null)} actions={
        <div className="grid w-full gap-2">
          {['Pre-Shift', 'Post-Shift'].map(s => (
            <button key={s} onClick={() => { setForm({ ...form, otType: s }); setModal({ mode: 'otDate' }); }} className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold hover:bg-slate-200">{s}</button>
          ))}
        </div>
      } />

      {/* OT Date */}
      <Modal open={modal?.mode === 'otDate'} title="Select OT Date" onClose={() => setModal(null)} actions={
        <div className="w-full">
          <input type="date" className="w-full rounded-lg border p-2 text-sm" min={formatDateMDY(new Date())}
            onChange={e => { if (e.target.value) { setForm({ ...form, otDate: formatDateMDY(new Date(e.target.value + 'T00:00:00')) }); setModal({ mode: 'otDetails' }); } }} />
        </div>
      } />

      {/* OT Details */}
      <Modal open={modal?.mode === 'otDetails'} title="OT Details" onClose={() => setModal(null)} actions={
        <div className="w-full space-y-3">
          <input className="w-full rounded-lg border p-2 text-sm" placeholder="Full Name" value={form.fullName || profile?.Full_Name || ''} onChange={e => setForm({ ...form, fullName: e.target.value })} />
          <textarea className="w-full rounded-lg border p-2 text-sm" placeholder="Reason for OverTime" value={form.reason || ''} onChange={e => setForm({ ...form, reason: e.target.value })} />
          <div className="flex gap-2">
            <input type="number" min={1} max={6} className="w-1/2 rounded-lg border p-2 text-sm" placeholder="Hours (1-6)" value={form.hours || ''} onChange={e => setForm({ ...form, hours: parseInt(e.target.value) || 0 })} />
            <input type="number" min={0} max={59} className="w-1/2 rounded-lg border p-2 text-sm" placeholder="Minutes" value={form.minutes || ''} onChange={e => setForm({ ...form, minutes: parseInt(e.target.value) || 0 })} />
          </div>
          <button onClick={submitOT} className="w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Submit OT</button>
        </div>
      } />

      {/* Tech Issue Date */}
      <Modal open={modal?.mode === 'techDate'} title="Tech Issue Date" onClose={() => setModal(null)} actions={
        <div className="w-full">
          <input type="date" className="w-full rounded-lg border p-2 text-sm"
            min={formatDateMDY(addDays(new Date(), -7))} max={formatDateMDY(new Date())}
            onChange={e => { if (e.target.value) { setForm({ ...form, techDate: formatDateMDY(new Date(e.target.value + 'T00:00:00')) }); setModal({ mode: 'techDetails' }); } }} />
        </div>
      } />

      {/* Tech Issue Details */}
      <Modal open={modal?.mode === 'techDetails'} title="Tech Issue Details" onClose={() => setModal(null)} actions={
        <div className="w-full space-y-3">
          <input className="w-full rounded-lg border p-2 text-sm" placeholder="Time of Issue (e.g., 9:00-11:00)" value={form.timeRange || ''} onChange={e => setForm({ ...form, timeRange: e.target.value })} />
          <input type="number" step="0.01" className="w-full rounded-lg border p-2 text-sm" placeholder="Hours Lost" value={form.hoursLost || ''} onChange={e => setForm({ ...form, hoursLost: e.target.value })} />
          <textarea className="w-full rounded-lg border p-2 text-sm" placeholder="Reason (e.g., Internet outage)" value={form.techReason || ''} onChange={e => setForm({ ...form, techReason: e.target.value })} />
          <button onClick={submitTech} className="w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Submit Coverage</button>
        </div>
      } />
    </div>
  );
}