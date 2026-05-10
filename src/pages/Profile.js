import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { db, ref, update } from '../firebase';
import Modal from '../components/Modal';

export default function Profile() {
  const nav = useNavigate();
  const { session, user, logout } = useAuth();
  const empId = session?.employeeId;
  const [modal, setModal] = useState(null);
  const [pass, setPass] = useState({ current:'', new:'', confirm:'' });
  const [gov, setGov] = useState({ PhilHealth:'', SSS:'', TIN:'', Pag_Ibig:'' });
  const [notes, setNotes] = useState(user?.Notes||'');

  const uploadImage = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      await update(ref(db, `Users/${empId}`), { Profile_Image: base64 });
    };
    reader.readAsDataURL(file);
  };

  const changePassword = async () => {
    const { current, new:np, confirm } = pass;
    if (!current) { alert('Current password is required.'); return; }
    if (np.length<8 || np.length>12) { alert('New password must be between 8 and 12 characters.'); return; }
    if (!/[A-Z]/.test(np)||!/[a-z]/.test(np)||!/[0-9]/.test(np)||!/[!@#$%^&*_+=-]/.test(np)) {
      alert('New password must include uppercase, lowercase, number, and special character.'); return;
    }
    if (np.includes(' ')) { alert('New password must not contain spaces.'); return; }
    if (np!==confirm) { alert('New passwords do not match.'); return; }
    if (user?.Password!==current) { alert('Current password is incorrect.'); return; }
    await update(ref(db, `Users/${empId}`), { Password: np });
    alert('Password changed successfully.');
    setModal(null);
  };

  const saveGov = async () => {
    const updates = {};
    if ((user?.PhilHealth||'N/A')==='N/A' && gov.PhilHealth) updates.PhilHealth = gov.PhilHealth;
    if ((user?.SSS||'N/A')==='N/A' && gov.SSS) updates.SSS = gov.SSS;
    if ((user?.TIN||'N/A')==='N/A' && gov.TIN) updates.TIN = gov.TIN;
    if ((user?.Pag_Ibig||'N/A')==='N/A' && gov.Pag_Ibig) updates.Pag_Ibig = gov.Pag_Ibig;
    if (Object.keys(updates).length) await update(ref(db, `Users/${empId}`), updates);
    alert('Government IDs updated.');
    setModal(null);
  };

  const saveNotes = async () => {
    await update(ref(db, `Users/${empId}`), { Notes: notes });
    alert('Notes saved.');
    setModal(null);
  };

  const needsGov = ['PhilHealth','SSS','TIN','Pag_Ibig'].some(k => (user?.[k]||'N/A')==='N/A');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <label className="relative h-20 w-20 cursor-pointer overflow-hidden rounded-full bg-slate-200">
          {user?.Profile_Image ? <img src={`data:image/jpeg;base64,${user.Profile_Image}`} alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-2xl">👤</div>}
          <input type="file" accept="image/*" className="hidden" onChange={uploadImage} />
        </label>
        <div>
          <div className="text-lg font-bold">{user?.Full_Name||'Agent'}</div>
          <div className="text-sm text-slate-500">{user?.Employee_ID_Number||''}</div>
          <div className={`mt-1 text-xs font-bold ${user?.isClockedIn?'text-green-600':'text-red-600'}`}>{user?.isClockedIn?'Clocked-In':'Clocked-Out'}</div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4 shadow">
        <h3 className="mb-2 font-bold">Information</h3>
        <div className="grid grid-cols-2 gap-y-2 text-sm">
          <div className="text-slate-500">Email</div><div>{user?.Primer_Email}</div>
          <div className="text-slate-500">Team</div><div>{user?.Team}</div>
          <div className="text-slate-500">Position</div><div>{user?.Position}</div>
          <div className="text-slate-500">Schedule</div><div>{user?.Schedule}</div>
          <div className="text-slate-500">Days Off</div><div>{user?.Days_Off}</div>
          <div className="text-slate-500">Status</div><div>{user?.Status}</div>
          <div className="text-slate-500">SL Credits</div><div>{user?.SL_Credits}</div>
          <div className="text-slate-500">VL Credits</div><div>{user?.VL_Credits}</div>
          <div className="text-slate-500">BL Credits</div><div>{user?.BL_Credit}</div>
        </div>
      </div>

      <div className="space-y-2">
        <button onClick={()=>setModal('password')} className="w-full rounded-lg bg-slate-100 py-3 text-sm font-bold text-slate-800">Change Password</button>
        {needsGov && <button onClick={()=>setModal('gov')} className="w-full rounded-lg bg-slate-100 py-3 text-sm font-bold text-slate-800">Update Government IDs</button>}
        <button onClick={()=>setModal('notes')} className="w-full rounded-lg bg-slate-100 py-3 text-sm font-bold text-slate-800">My Notes</button>
        <button onClick={()=>nav('/change-leave')} className="w-full rounded-lg bg-slate-100 py-3 text-sm font-bold text-slate-800">Change Leave Date</button>
        <button onClick={()=>nav('/coverage-records')} className="w-full rounded-lg bg-slate-100 py-3 text-sm font-bold text-slate-800">Coverage Records</button>
        <button onClick={logout} className="w-full rounded-lg bg-red-100 py-3 text-sm font-bold text-red-700">Logout</button>
      </div>

      <Modal open={modal==='password'} title="Change Password" onClose={()=>setModal(null)} actions={
        <div className="w-full space-y-2">
          <input type="password" className="w-full rounded-lg border p-2 text-sm" placeholder="Current Password" value={pass.current} onChange={e=>setPass({...pass, current:e.target.value})} />
          <input type="password" className="w-full rounded-lg border p-2 text-sm" placeholder="New Password" value={pass.new} onChange={e=>setPass({...pass, new:e.target.value})} />
          <input type="password" className="w-full rounded-lg border p-2 text-sm" placeholder="Confirm New Password" value={pass.confirm} onChange={e=>setPass({...pass, confirm:e.target.value})} />
          <button onClick={changePassword} className="w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Change</button>
        </div>
      } />

      <Modal open={modal==='gov'} title="Update Government IDs" onClose={()=>setModal(null)} actions={
        <div className="w-full space-y-2">
          {(user?.PhilHealth||'N/A')==='N/A' && <input className="w-full rounded-lg border p-2 text-sm" placeholder="PhilHealth" value={gov.PhilHealth} onChange={e=>setGov({...gov, PhilHealth:e.target.value})} />}
          {(user?.SSS||'N/A')==='N/A' && <input className="w-full rounded-lg border p-2 text-sm" placeholder="SSS" value={gov.SSS} onChange={e=>setGov({...gov, SSS:e.target.value})} />}
          {(user?.TIN||'N/A')==='N/A' && <input className="w-full rounded-lg border p-2 text-sm" placeholder="TIN" value={gov.TIN} onChange={e=>setGov({...gov, TIN:e.target.value})} />}
          {(user?.Pag_Ibig||'N/A')==='N/A' && <input className="w-full rounded-lg border p-2 text-sm" placeholder="Pag-Ibig" value={gov.Pag_Ibig} onChange={e=>setGov({...gov, Pag_Ibig:e.target.value})} />}
          <button onClick={saveGov} className="w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Save</button>
        </div>
      } />

      <Modal open={modal==='notes'} title="My Notes" onClose={()=>setModal(null)} actions={
        <div className="w-full">
          <textarea className="w-full rounded-lg border p-2 text-sm" rows={5} value={notes} onChange={e=>setNotes(e.target.value)} />
          <button onClick={saveNotes} className="mt-2 w-full rounded-lg bg-primer-accent py-2 text-sm font-bold text-white">Save</button>
        </div>
      } />
    </div>
  );
}