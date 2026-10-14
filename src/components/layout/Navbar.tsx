import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types';
import { Shield, Sparkles, User, LogIn, LogOut } from 'lucide-react';
import { AuthModal } from '../auth/AuthModal';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const {
    currentUser,
    switchRole,
    supabaseStatus,
    authMode,
    signOut,
  } = useAuth();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const navLinks = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'decisions', label: 'Decision Register' },
    { id: 'catalogue', label: '33 Master Types' },
    { id: 'a0-check', label: 'A0 Screening' },
    { id: 'projects', label: 'Projects' },
    { id: 'services', label: 'Services & Selldone' },
    { id: 'audit', label: 'Audit & Admin' },
  ];

  return (
    <>
      <header className="bg-white border-b border-stone-200 sticky top-0 z-40">
        {/* Top telemetry bar */}
        <div className="bg-stone-900 text-stone-200 px-4 py-1.5 text-xs border-b border-stone-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {authMode === 'authenticated' ? (
              <>
                <span className="font-semibold text-emerald-400">AUTHENTICATED</span>
                <span aria-hidden="true" className="text-stone-600">·</span>
                <span className="font-mono text-stone-300">{currentUser.email}</span>
                <span aria-hidden="true" className="text-stone-600">·</span>
                <span className="capitalize text-stone-400">Server Role: {currentUser.role}</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-amber-400">DEMONSTRATION MODE</span>
                <span aria-hidden="true" className="text-stone-600">·</span>
                <span>Operating with browser LocalStorage persistence (Phase 1 & 2 safe sandbox).</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3 text-stone-400 font-mono text-[11px] tabular-nums">
            {supabaseStatus.isConfigured ? (
              <span className="text-emerald-400">Supabase: Configured</span>
            ) : (
              <span className="text-stone-400">Supabase: Local Demo</span>
            )}
            <span aria-hidden="true" className="text-stone-700">·</span>
            <span>Shop ID 2906</span>
          </div>
        </div>

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

          {/* Zone 3: 1 Primary Action / Persona Selector / Auth Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            {authMode === 'authenticated' ? (
              <div className="flex items-center gap-2">
                <div className="text-xs bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                  <span className="text-stone-500 mr-1">Role:</span>
                  <span className="font-semibold text-stone-900 capitalize">{currentUser.role}</span>
                </div>
                <button
                  onClick={signOut}
                  className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Sign out of Supabase account"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-stone-100 p-1 rounded-lg border border-stone-200">
                  <select
                    value={currentUser.role}
                    onChange={(e) => switchRole(e.target.value as UserRole)}
                    className="text-xs font-medium text-stone-800 bg-white border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-stone-500 cursor-pointer"
                    title="Switch user perspective to test Role-Based Access Control (Demonstration Only)"
                  >
                    <option value="customer">Demo: Customer (Vikram M.)</option>
                    <option value="designer">Demo: Architect (Ar. Priya)</option>
                    <option value="project_manager">Demo: PM (Karan Sen)</option>
                    <option value="admin">Demo: Admin [Evaluation]</option>
                  </select>
                </div>

                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Sign In with real Supabase credentials"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            )}

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

      {/* Real Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </>
  );
};
