import { useEffect } from 'react';

export function useNotifications() {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const schedule = (title, body, whenMs) => {
    const delay = whenMs - Date.now();
    if (delay <= 0) return;
    setTimeout(() => {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    }, delay);
  };

  return { schedule };
}