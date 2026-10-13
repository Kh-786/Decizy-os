import React, { useState } from 'react';
import { useProjects } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  FileText,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Database,
  Terminal,
  Activity,
  Layers,
} from 'lucide-react';

export const AdminAuditView: React.FC = () => {
  const { auditLogs, projects, decisions } = useProjects();
  const { currentUser, activeRole, supabaseStatus } = useAuth();

  const [filterAction, setFilterAction] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = filterAction === 'All' || log.action === filterAction;
    const matchesSearch =
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.action.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAction && matchesSearch;
  });

  const rlsTablePolicies = [
    {
      table: 'profiles',
      rlsEnabled: true,
      selectPolicy: 'Own profile (auth.uid() = id) OR admin',
      insertPolicy: 'Supabase auth trigger on signup',
      updatePolicy: 'Own profile only',
    },
    {
      table: 'projects',
      rlsEnabled: true,
      selectPolicy: 'Project participants (Customer, Designer, PM) OR admin',
      insertPolicy: 'Designers, PMs, or Admin only',
      updatePolicy: 'Authorized team members only',
    },
    {
      table: 'project_decisions',
      rlsEnabled: true,
      selectPolicy: 'Project members only',
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
      insertPolicy: 'Authenticated users / system triggers',
      updatePolicy: 'Immutable (No UPDATE or DELETE permitted)',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
          <span>Module L</span>
          <span aria-hidden="true">·</span>
          <span>Security & Governance</span>
          <span aria-hidden="true">·</span>
          <span>Audit Register</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          Audit Trail & System Administration
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Durable, chronological record of every status change, material revision, approval, and downstream dependency flag.
        </p>
      </div>

      {/* Security & RLS Compliance Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
            <Lock className="w-4 h-4 text-emerald-700" />
            <span>Row Level Security (RLS)</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-stone-900 mt-2">
            6 / 6 Tables Protected
          </div>
          <p className="text-xs text-stone-500 mt-1">
            PostgreSQL policies enforce cross-user and cross-project isolation.
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
            <Database className="w-4 h-4 text-stone-700" />
            <span>Database Backend State</span>
          </div>
          <div className="text-xl font-bold text-stone-900 mt-2 capitalize">
            {supabaseStatus.mode} Mode
          </div>
          <p className="text-xs text-stone-500 mt-1 line-clamp-2">
            {supabaseStatus.statusMessage}
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-stone-500 uppercase">
            <Activity className="w-4 h-4 text-stone-700" />
            <span>Audit Trail Entries</span>
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-stone-900 mt-2">
            {auditLogs.length} Events Logged
          </div>
          <p className="text-xs text-stone-500 mt-1">
            Immutable log with actor IDs, roles, and timestamps.
          </p>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-base font-bold text-stone-900">
            Durable Operational Audit Trail
          </h2>

          <div className="flex items-center gap-3">
            {/* Filter Action */}
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

            {/* Search */}
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
          Documented security architecture enforced in <span className="font-mono text-stone-700">supabase/migrations/20261013000000_initial_decizy_schema.sql</span>.
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
    </div>
  );
};
