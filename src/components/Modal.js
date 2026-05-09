import React from 'react';

export default function Modal({ open, title, children, onClose, actions }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        {title && <h3 className="mb-4 text-lg font-bold text-slate-800">{title}</h3>}
        <div className="mb-6 text-sm text-slate-600">{children}</div>
        <div className="flex flex-wrap justify-end gap-2">
          {actions || (
            <button onClick={onClose} className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-300">Close</button>
          )}
        </div>
      </div>
    </div>
  );
}