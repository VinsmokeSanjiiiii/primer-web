import React, { createContext, useContext, useState, useEffect } from 'react';
import { db, ref, query, orderByChild, equalTo, get, onValue, off } from '../firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = localStorage.getItem('primer_session');
    if (raw) {
      try {
        const s = JSON.parse(raw);
        setSession(s);
      } catch { localStorage.removeItem('primer_session'); }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session?.employeeId) { setUser(null); return; }
    const r = ref(db, `Users/${session.employeeId}`);
    onValue(r, snap => { if (snap.exists()) setUser(snap.val()); });
    return () => off(r);
  }, [session]);

  const login = async (email, password, remember) => {
    const q = query(ref(db, 'Users'), orderByChild('Primer_Email'), equalTo(email));
    const snap = await get(q);
    if (!snap.exists()) return { ok:false, error:'Account does not exist.' };
    let found = null; let key = null;
    snap.forEach(c => { if (!found) { found = c.val(); key = c.key; } });
    if (!found || found.Password !== password) return { ok:false, error:'Incorrect password.' };
    const s = { employeeId: found.Employee_ID_Number || key, email, remember };
    setSession(s);
    if (remember) localStorage.setItem('primer_session', JSON.stringify(s));
    else localStorage.removeItem('primer_session');
    return { ok:true };
  };

  const logout = () => {
    setSession(null); setUser(null);
    localStorage.removeItem('primer_session');
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);