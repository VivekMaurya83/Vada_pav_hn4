import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Landing from '../pages/Landing';
import Auth from '../pages/Auth';
import Dashboard from '../pages/Dashboard';
import Scan from '../pages/Scan';
import Reports from '../pages/Reports';
import Report from '../pages/Report';
import Projects from '../pages/Projects';
import Settings from '../pages/Settings';
import Analytics from '../pages/Analytics';

import ProtectedRoute from '../components/layout/ProtectedRoute';
import Layout from '../components/layout/Layout';
import PageTransition from '../components/layout/PageTransition';
import ExtensionManagement from '../components/sections/ExtensionManagement';

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scan" element={<Scan />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/extension" element={
            <PageTransition>
              <div className="space-y-8">
                <div>
                  <h1 className="text-3xl font-bold text-white mb-2">Chrome Extensions</h1>
                  <p className="text-slate-400">Manage and install the AccessiScan auditor browser tools.</p>
                </div>
                <ExtensionManagement onFileUpload={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    console.log('File selected:', file.name);
                    // Mock redirect for localized report view
                    window.location.hash = '/report/local-123'; 
                  }
                }} />
              </div>
            </PageTransition>
          } />
        </Route>
      </Route>
    </Routes>
  );
}
