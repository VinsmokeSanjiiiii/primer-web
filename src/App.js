import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Splash from './pages/Splash';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Clock from './pages/Clock';
import AttendanceRecords from './pages/AttendanceRecords';
import Requests from './pages/Requests';
import Coverage from './pages/Coverage';
import Profile from './pages/Profile';
import Infractions from './pages/Infractions';
import ChangeLeave from './pages/ChangeLeave';
import CoverageRecords from './pages/CoverageRecords';
import Layout from './components/Layout';

function Protected({ children }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Splash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Protected><Layout><Dashboard /></Layout></Protected>} />
          <Route path="/clock" element={<Protected><Layout><Clock /></Layout></Protected>} />
          <Route path="/attendance" element={<Protected><Layout><AttendanceRecords /></Layout></Protected>} />
          <Route path="/requests" element={<Protected><Layout><Requests /></Layout></Protected>} />
          <Route path="/coverage" element={<Protected><Layout><Coverage /></Layout></Protected>} />
          <Route path="/profile" element={<Protected><Layout><Profile /></Layout></Protected>} />
          <Route path="/infractions" element={<Protected><Layout><Infractions /></Layout></Protected>} />
          <Route path="/change-leave" element={<Protected><Layout><ChangeLeave /></Layout></Protected>} />
          <Route path="/coverage-records" element={<Protected><Layout><CoverageRecords /></Layout></Protected>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}