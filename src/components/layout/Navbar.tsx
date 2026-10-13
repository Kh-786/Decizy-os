import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Shield, Sparkles, User, Database } from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { currentUser, switchRole, supabaseStatus } = useAuth();

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'decisions', label: 'Decision Register' },
    { id: 'catalogue', label: '33 Master Types' },
    { id: 'a0-check', label: 'A0 Screening' },
    { id: 'projects', label: 'Projects' },
    { id: 'services', label: 'Services & Selldone' },
    { id: 'audit', label: 'Audit & Admin' },
  ];

  const roleLabels: Record<UserRole, string> = {
    customer: 'Customer / Owner',
    designer: 'Lead Architect',
    project_manager: 'Project Manager',
    admin: 'Platform Admin',
  };

  return (
    <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
      {/* Safe Demo Mode Sub-Banner if Supabase not configured */}
      {!supabaseStatus.isConfigured && (
        <div className="bg-stone-900 text-stone-200 px-4 py-1.5 text-xs border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-amber-400">DEMONSTRATION MODE</span>
            <span aria-hidden="true" className="text-stone-600">·</span>
            <span>Running with safe local seed data. Database writes are kept in memory to prevent accidental remote mutation.</span>
          </div>
          <div className="flex items-center gap-2 text-stone-400 font-mono text-[11px] tabular-nums">
            <span>Shop ID 2906</span>
            <span aria-hidden="true">·</span>
            <span>Supabase RLS Ready</span>
          </div>
        </div>
      )}

      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('dashboard')}
            className="text-xl font-bold tracking-tight text-stone-900 hover:text-stone-700 transition-colors whitespace-nowrap text-left"
          >
            Decizy
            <span className="text-xs font-normal text-stone-500 block -mt-1 tracking-normal">
              AnyRoomz Decision Intelligence
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links (4-7 single line links) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600 overflow-x-auto">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => setActiveTab(link.id)}
              className={`whitespace-nowrap transition-colors py-1 border-b-2 ${
                activeTab === link.id
                  ? 'border-stone-900 text-stone-900 font-semibold'
                  : 'border-transparent hover:text-stone-900 hover:border-stone-300'
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 Primary Action / Persona Selector */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-stone-100 p-1 rounded-lg border border-stone-200">
            <span className="text-xs text-stone-500 pl-2 font-medium hidden sm:inline">Role:</span>
            <select
              value={currentUser.role}
              onChange={(e) => switchRole(e.target.value as UserRole)}
              className="text-xs font-medium text-stone-800 bg-white border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-stone-500 cursor-pointer"
              title="Switch user perspective to test Role-Based Access Control"
            >
              <option value="customer">Customer ({roleLabels.customer})</option>
              <option value="designer">Designer ({roleLabels.designer})</option>
              <option value="project_manager">PM ({roleLabels.project_manager})</option>
              <option value="admin">Admin ({roleLabels.admin})</option>
            </select>
          </div>

          <button
            onClick={() => setActiveTab('a0-check')}
            className="px-3.5 py-1.5 text-xs font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap hidden sm:inline-flex items-center gap-1.5 shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>A0 Check</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation strip */}
      <div className="md:hidden flex items-center gap-3 px-4 py-2 border-t border-stone-100 overflow-x-auto text-xs text-stone-600">
        {navLinks.map((link) => (
          <button
            key={link.id}
            onClick={() => setActiveTab(link.id)}
            className={`whitespace-nowrap py-1 px-2 rounded ${
              activeTab === link.id
                ? 'bg-stone-900 text-white font-medium'
                : 'hover:bg-stone-100 text-stone-600'
            }`}
          >
            {link.label}
          </button>
        ))}
      </div>
    </header>
  );
};
