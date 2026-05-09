import React from 'react';
import BottomNav from './BottomNav';

export default function Layout({ children }) {
  return (
    <div className="mx-auto min-h-screen max-w-3xl bg-white shadow-xl">
      <main className="pb-24 pt-4 px-4">{children}</main>
      <BottomNav />
    </div>
  );
}