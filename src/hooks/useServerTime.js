import { useState, useEffect, useCallback } from 'react';
import { db, ref, onValue, off } from '../firebase';

export function useServerTime() {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const r = ref(db, '.info/serverTimeOffset');
    onValue(r, snap => {
      const v = snap.val() || 0;
      setOffset(typeof v==='number'?v:0);
    });
    return () => off(r);
  }, []);

  const nowMs = () => Date.now() + offset;

  const toManilaMs = useCallback((ms) => {
    const d = new Date(ms || nowMs());
    const manila = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
    const diff = d.getTime() - manila.getTime();
    return d.getTime() - diff;
  }, [offset]);

  return { offset, nowMs, toManilaMs };
}