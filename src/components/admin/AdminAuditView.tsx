import React, { useState, useRef } from 'react';
import { useProjects } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  FileText,
  Search,
  CheckCircle2,
  Lock,
  Database,
  Activity,
  Download,
  Upload,
  RotateCcw,
  AlertTriangle,
  HardDrive,
  Info,
  Server,
  RefreshCw,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import { testSupabaseConnection } from '../../lib/supabase';

export const AdminAuditView: React.FC = () => {
  const {
    auditLogs,
    projects,
    decisions,
    assessments,
    storageStatus,
    exportDemoData,
    importDemoData,
    resetDemoData,
    dbError,
    clearDbError,
  } = useProjects();
  const { currentUser, activeRole, supabaseStatus, authMode, securityNotice } = useAuth();

  const [filterAction, setFilterAction] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Storage management state
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [importNotification, setImportNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Supabase connection test state
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<{
    tested: boolean;
    success: boolean;
    latencyMs?: number;
    message: string;
    error?: string;
    timestamp: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = filterAction === 'All' || log.action === filterAction;
    const matchesSearch =
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    try {
      const result = await testSupabaseConnection();
      setConnectionTestResult({
        tested: true,
        success: result.success,
        latencyMs: result.latencyMs,
        message: result.message,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleExport = () => {
    try {
      const jsonString = exportDemoData();
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      link.href = url;
      link.download = `decizy-demo-data-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) {
        setImportNotification({
          type: 'error',
          message: 'Selected file was empty or unreadable.',
        });
        return;
      }

      const result = importDemoData(content);
      if (result.success) {
        setImportNotification({
          type: 'success',
          message: 'Demonstration data successfully imported and verified against schema v1.',
        });
      } else {
        setImportNotification({
          type: 'error',
          message: `Import rejected: ${result.error}. Existing data was preserved intact.`,
        });
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setImportNotification({
        type: 'error',
        message: 'Could not read file from filesystem.',
      });
    };

    reader.readAsText(file);
  };

  const handleConfirmReset = () => {
    resetDemoData();
    setIsResetConfirmOpen(false);
    setImportNotification({
      type: 'success',
      message: 'Demonstration data was reset to original seed state. Local modifications cleared.',
    });
  };

  const rlsTablePolicies = [
    {
      table: 'profiles',
      rlsEnabled: true,
      selectPolicy: 'Own profile (auth.uid() = id) OR admin',
      insertPolicy: 'Handled strictly by handle_new_user() trigger',
      updatePolicy: 'Self update (role self-elevation blocked by trigger)',
    },
    {
      table: 'projects',
      rlsEnabled: true,
      selectPolicy: 'Project participants (Owner, Designer, PM, Member) OR admin',
      insertPolicy: 'Designers, PMs, or Admin only',
      updatePolicy: 'Authorized team members only',
    },
    {
      table: 'project_members',
      rlsEnabled: true,
      selectPolicy: 'Project participants only (can_access_project)',
      insertPolicy: 'Admins, PMs and Designers only',
      updatePolicy: 'Immutable membership records (Delete only)',
    },
    {
      table: 'project_decisions',
      rlsEnabled: true,
      selectPolicy: 'Project participants only',
      insertPolicy: 'Designers, PMs, or Admin only',
      updatePolicy: 'Role workflow: customer signs off, designer/PM edits',
    },
    {
      table: 'decision_revisions',
      rlsEnabled: true,
      selectPolicy: 'Project members only (Append-only immutable)',
      insertPolicy: 'Authorized participants on decision revision',
      updatePolicy: 'Restricted (Revisions cannot be overwritten)',
    },
    {
      table: 'a0_assessments',
      rlsEnabled: true,
      selectPolicy: 'Submitter email OR staff/admin',
      insertPolicy: 'Public intake (Anyone can submit screening)',
      updatePolicy: 'Admin or assigned designer only',
    },
    {
      table: 'audit_logs',
      rlsEnabled: true,
      selectPolicy: 'Project participants OR admin',
      insertPolicy: 'Authenticated users (actor_id = auth.uid())',
      updatePolicy: 'IMMUTABLE: UPDATE and DELETE blocked by trigger',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
          <span>Module L</span>
          <span aria-hidden="true">·</span>
          <span>Security, Persistence & Governance</span>
          <span aria-hidden="true">·</span>
          <span>Phase 2</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          Security Administration & Supabase Integration
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          PostgreSQL Row Level Security (RLS), real user authentication, append-only audit trail, and persistent storage telemetry.
        </p>
      </div>

      {/* Database Error Banner if active */}
      {dbError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Database Persistence Exception:</span>
              <p className="mt-0.5 text-rose-800">{dbError}</p>
            </div>
          </div>
          <button onClick={clearDbError} className="text-rose-700 hover:text-rose-900 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Security & Persona Notice */}
      <div className="p-4 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-700 flex items-start gap-3">
        <Info className="w-4 h-4 text-stone-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-stone-900">Operating Mode & Access Boundary:</span>
          <p className="text-stone-600">{securityNotice}</p>
        </div>
      </div>

      {/* PHASE 2: Supabase Integration & Health Panel */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase">
              <Server className="w-4 h-4 text-stone-700" />
              <span>Phase 2 — Supabase Connectivity & Authentication Engine</span>
            </div>
            <h2 className="text-lg font-bold text-stone-900 mt-0.5">
              Supabase Health & Integration Status
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Verify live PostgreSQL connection, Row Level Security readiness, and authentication token handling.
            </p>
          </div>

          <button
            onClick={handleTestConnection}
            disabled={isTestingConnection}
            className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTestingConnection ? 'animate-spin' : ''}`} />
            <span>{isTestingConnection ? 'Testing Connection...' : 'Test Connection'}</span>
          </button>
        </div>

        {/* Connection Test Diagnostic Banner */}
        {connectionTestResult && (
          <div
            className={`p-4 rounded-xl text-xs border flex items-start justify-between gap-3 ${
              connectionTestResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}
          >
            <div className="flex items-start gap-2.5">
              {connectionTestResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold">
                  {connectionTestResult.success ? 'Connectivity Verified' : 'Connectivity Report'}:
                </span>
                <p className="mt-0.5">{connectionTestResult.message}</p>
                {connectionTestResult.latencyMs && (
                  <span className="font-mono tabular-nums text-[11px] text-stone-500 block mt-1">
                    Latency: {connectionTestResult.latencyMs}ms · Tested at {new Date(connectionTestResult.timestamp).toLocaleTimeString('en-IN')}
                  </span>
                )}
                {connectionTestResult.error && (
                  <p className="font-mono text-[11px] text-stone-600 mt-1">
                    Details: {connectionTestResult.error}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setConnectionTestResult(null)}
              className="text-stone-500 hover:text-stone-800 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-stone-400 block text-[11px]">Configuration</span>
            <div className="font-bold text-stone-900 mt-0.5">
              {supabaseStatus.isConfigured ? 'Live Configured' : 'Missing (Demo Active)'}
            </div>
            <div className="text-[11px] text-stone-500 font-mono">
              {supabaseStatus.maskedKey ? `Key: ${supabaseStatus.maskedKey}` : 'No Public Key'}
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-stone-400 block text-[11px]">Auth Session</span>
            <div className="font-bold text-stone-900 mt-0.5 capitalize">
              {authMode === 'authenticated' ? 'Authenticated' : 'Local Demo Persona'}
            </div>
            <div className="text-[11px] text-stone-500 truncate">
              {authMode === 'authenticated' ? currentUser.email : 'Vikram Malhotra (Demo)'}
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-stone-400 block text-[11px]">Active Target URL</span>
            <div className="font-bold text-stone-900 mt-0.5 truncate font-mono text-[11px]">
              {supabaseStatus.url || 'None (Local Store)'}
            </div>
            <div className="text-[11px] text-stone-500">Zero secrets exposed</div>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-stone-400 block text-[11px]">Security Migrations</span>
            <div className="font-bold text-stone-900 mt-0.5">
              2 Migration Scripts
            </div>
            <div className="text-[11px] text-stone-500 font-mono">20261013000001 (Phase 2)</div>
          </div>
        </div>

        {/* Developer Setup Instructions Accordion */}
        <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-2">
          <h3 className="font-bold text-stone-900 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-stone-700" />
            <span>Developer Instructions for Live Supabase Integration</span>
          </h3>
          <p className="text-stone-600 leading-relaxed text-[11px]">
            To connect Decizy to a live Supabase PostgreSQL instance:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-stone-600 text-[11px] font-mono">
            <li>Create a project in the Supabase Dashboard (<span className="text-stone-800">https://supabase.com</span>).</li>
            <li>In Project Settings $\rightarrow$ API, copy Project URL and Publishable Anon Key.</li>
            <li>Set in your local <span className="text-stone-900 font-bold">.env</span>:
              <span className="block pl-4 text-stone-800">VITE_SUPABASE_URL="https://your-project.supabase.co"</span>
              <span className="block pl-4 text-stone-800">VITE_SUPABASE_ANON_KEY="eyJhbG..."</span>
            </li>
            <li>In Supabase SQL Editor, run both additive migration files:
              <span className="block pl-4 text-stone-800">1. supabase/migrations/20261013000000_initial_decizy_schema.sql</span>
              <span className="block pl-4 text-stone-800">2. supabase/migrations/20261013000001_phase2_security_and_memberships.sql</span>
            </li>
          </ol>
        </div>
      </div>

      {/* PHASE 1: Demonstration Data Persistence & Control Section */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase">
              <HardDrive className="w-4 h-4 text-stone-700" />
              <span>Phase 1 — Browser Local Storage Sandbox</span>
            </div>
            <h2 className="text-lg font-bold text-stone-900 mt-0.5">
              Demonstration Mode Persistence & State Backups
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Isolated offline storage ensuring demo additions and approvals persist across page reloads without touching remote tables.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExport}
              className="px-3.5 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Download clean JSON backup of current demo data"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <label className="px-3.5 py-1.5 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" />
              <span>Import JSON</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            <button
              onClick={() => setIsResetConfirmOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 transition-colors"
              title="Restore initial seed state"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset to Seed Data</span>
            </button>
          </div>
        </div>

        {importNotification && (
          <div
            className={`p-3.5 rounded-lg text-xs flex items-start justify-between gap-2 border ${
              importNotification.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              {importNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
              )}
              <span>{importNotification.message}</span>
            </div>
            <button
              onClick={() => setImportNotification(null)}
              className="text-stone-500 hover:text-stone-800 font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Telemetry Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-stone-400 block text-[11px]">Storage Driver</span>
            <div className="font-bold text-stone-900 mt-0.5">
              {storageStatus.availability === 'available'
                ? 'Browser LocalStorage'
                : 'In-Memory Fallback'}
            </div>
            <div className="text-[11px] text-stone-500">Schema v{storageStatus.schemaVersion}</div>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-stone-400 block text-[11px]">Last Saved Timestamp</span>
            <div className="font-bold text-stone-900 mt-0.5 font-mono tabular-nums">
              {storageStatus.lastSavedAt
                ? new Date(storageStatus.lastSavedAt).toLocaleTimeString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })
                : 'Initial'}
            </div>
            <div className="text-[11px] text-stone-500 font-mono tabular-nums">
              {storageStatus.lastSavedAt
                ? new Date(storageStatus.lastSavedAt).toLocaleDateString('en-IN')
                : 'Pending'}
            </div>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-stone-400 block text-[11px]">Projects & Decisions</span>
            <div className="font-bold text-stone-900 mt-0.5 font-mono tabular-nums">
              {projects.length} Projects · {decisions.length} Decisions
            </div>
            <div className="text-[11px] text-stone-500">Persisted locally</div>
          </div>

          <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
            <span className="text-stone-400 block text-[11px]">Intakes & Audit Events</span>
            <div className="font-bold text-stone-900 mt-0.5 font-mono tabular-nums">
              {assessments.length} A0 · {auditLogs.length} Events
            </div>
            <div className="text-[11px] text-stone-500">Zero sensitive secrets stored</div>
          </div>
        </div>
      </div>

      {/* Durable Operational Audit Trail Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              Durable Operational Audit Trail
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Immutable chronological record of decision approvals, status changes, and material revisions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-stone-300 rounded-lg bg-white"
            >
              <option value="All">All Event Types</option>
              <option value="APPROVE_DECISION">Approvals</option>
              <option value="REQUEST_CHANGES">Change Requests</option>
              <option value="MATERIAL_REVISION_APPLIED">Material Revisions</option>
              <option value="FLAGGED_DOWNSTREAM">Dependency Flags</option>
              <option value="A0_SUBMISSION_RECEIVED">A0 Intakes</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search audit entries..."
                className="text-xs pl-8 pr-3 py-1.5 border border-stone-300 rounded-lg w-48"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                <th className="py-3 px-4">Timestamp (IST)</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-stone-500">
                    No audit records match the current filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-stone-500 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                      })}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-stone-800 whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 font-semibold text-stone-900 whitespace-nowrap">
                      {log.actorName}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap capitalize text-stone-600">
                      {log.actorRole.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-4 text-stone-700 leading-relaxed max-w-xl">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row Level Security Specification Matrix */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs">
        <h2 className="text-base font-bold text-stone-900 mb-1">
          Supabase Row Level Security (RLS) Policy Specifications
        </h2>
        <p className="text-xs text-stone-500 mb-4">
          Database-enforced security rules applied in <span className="font-mono text-stone-700">supabase/migrations/20261013000001_phase2_security_and_memberships.sql</span>.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Table Name</th>
                <th className="py-2.5 px-3">RLS Status</th>
                <th className="py-2.5 px-3">SELECT Policy</th>
                <th className="py-2.5 px-3">INSERT Policy</th>
                <th className="py-2.5 px-3">UPDATE Policy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rlsTablePolicies.map((p) => (
                <tr key={p.table} className="hover:bg-stone-50">
                  <td className="py-2.5 px-3 font-mono font-bold text-stone-900">{p.table}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="text-[11px] font-mono font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                      ENABLED
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-stone-600">{p.selectPolicy}</td>
                  <td className="py-2.5 px-3 text-stone-600">{p.insertPolicy}</td>
                  <td className="py-2.5 px-3 text-stone-600">{p.updatePolicy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-xl text-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-700 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-900">
                  Reset Demonstration Data?
                </h3>
                <p className="text-stone-600 text-xs mt-1 leading-relaxed">
                  This will clear all local browser additions, decision sign-offs, and A0 intake records, restoring Decizy back to the clean seed dataset.
                </p>
                <p className="text-stone-500 text-[11px] mt-2">
                  Tip: Use <span className="font-semibold text-stone-800">Export JSON</span> first if you wish to preserve your current test decisions.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 rounded-lg transition-colors"
              >
                Confirm Reset to Seed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
