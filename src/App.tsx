import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ProjectProvider } from './context/ProjectContext';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { DecisionRegisterView } from './components/decisions/DecisionRegisterView';
import { MasterCatalogueView } from './components/decisions/MasterCatalogueView';
import { A0AssessmentView } from './components/a0/A0AssessmentView';
import { ProjectsView } from './components/projects/ProjectsView';
import { ServicesAndCommerceView } from './components/services/ServicesAndCommerceView';
import { AdminAuditView } from './components/admin/AdminAuditView';

export function DecizyApp() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && <DashboardView onNavigate={setActiveTab} />}
        {activeTab === 'decisions' && <DecisionRegisterView />}
        {activeTab === 'catalogue' && <MasterCatalogueView />}
        {activeTab === 'a0-check' && <A0AssessmentView />}
        {activeTab === 'projects' && <ProjectsView />}
        {activeTab === 'services' && <ServicesAndCommerceView />}
        {activeTab === 'audit' && <AdminAuditView />}
      </main>

      {/* Quiet Professional Footer per Frontend Constitution */}
      <footer className="bg-white border-t border-stone-200 py-8 text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="font-bold text-stone-800">Decizy</span>
            <span className="mx-2 text-stone-300">·</span>
            <span>Decision Intelligence Platform of AnyRoomz (Shop 2906)</span>
            <span className="mx-2 text-stone-300">·</span>
            <span>Target Market: India (INR, Metric Units)</span>
          </div>

          <div className="flex items-center gap-6">
            <a
              href="https://anyroomz.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-stone-900 transition-colors"
            >
              AnyRoomz Official
            </a>
            <button
              onClick={() => setActiveTab('a0-check')}
              className="hover:text-stone-900 transition-colors"
            >
              A0 Decision Check
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className="hover:text-stone-900 transition-colors"
            >
              Audit & Governance
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProjectProvider>
        <DecizyApp />
      </ProjectProvider>
    </AuthProvider>
  );
}
