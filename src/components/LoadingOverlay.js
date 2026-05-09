import React from 'react';

export default function LoadingOverlay({ message }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-primer-accent"></div>
      <p className="mt-4 text-sm font-medium text-slate-600">{message || 'Loading...'}</p>
    </div>
  );
}