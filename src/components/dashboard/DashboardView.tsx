import React from 'react';
import { useProjects } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import {
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FolderKanban,
  FileCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { projects, selectedProject, decisions, assessments, setSelectedProjectId } =
    useProjects();
  const { currentUser } = useAuth();

  const projectDecisions = decisions.filter(
    (d) => d.projectId === selectedProject?.id
  );

  const pendingApprovals = projectDecisions.filter(
    (d) => d.status === 'Under Review' || d.status === 'Submitted'
  );

  const flaggedDecisions = projectDecisions.filter((d) => d.flaggedForReview);

  const approvedDecisions = projectDecisions.filter((d) => d.status === 'Approved');

  const totalBudgetINR = projects.reduce((acc, p) => acc + p.budgetINR, 0);
  const totalSpentINR = projects.reduce((acc, p) => acc + p.spentINR, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner / Project Focus */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
            <span>Executive Overview</span>
            <span aria-hidden="true">·</span>
            <span>AnyRoomz Decizy Engine</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-stone-900">{selectedProject?.code}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            {selectedProject?.title}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            {selectedProject?.city} · {selectedProject?.type} · {selectedProject?.areaSqFt.toLocaleString('en-IN')} sq.ft · Stage: {selectedProject?.stage}
          </p>
        </div>

        {/* Quick Project Switcher */}
        <div className="flex items-center gap-3">
          <div className="bg-white border border-stone-200 rounded-lg p-1.5 shadow-xs">
            <span className="text-xs text-stone-500 pl-2 font-medium">Switch Project:</span>
            <select
              value={selectedProject?.id}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs font-semibold text-stone-900 bg-transparent border-0 focus:ring-0 cursor-pointer pr-4"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} ({p.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onNavigate('decisions')}
            className="px-3.5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span>Open Register</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Metric Strips (Strictly unboxed, tabular numerals, 1-level flat surfaces) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-medium text-stone-500 block">Pending Sign-Offs</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {pendingApprovals.length}
          </div>
          <div className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
            <span>Awaiting owner or architect action</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-medium text-stone-500 block">Flagged for Review</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-rose-700 mt-1">
            {flaggedDecisions.length}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            <span>Upstream dependency altered</span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-medium text-stone-500 block">Locked Decisions</span>
          <div className="text-2xl font-bold font-mono tabular-nums text-stone-900 mt-1">
            {approvedDecisions.length} / {projectDecisions.length}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            <span>
              {projectDecisions.length > 0
                ? Math.round((approvedDecisions.length / projectDecisions.length) * 100)
                : 0}
              % locked milestones
            </span>
          </div>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5 shadow-xs">
          <span className="text-xs font-medium text-stone-500 block">Committed Budget (INR)</span>
          <div className="text-xl font-bold font-mono tabular-nums text-stone-900 mt-1">
            ₹{selectedProject?.spentINR.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-stone-500 mt-1">
            <span>of ₹{selectedProject?.budgetINR.toLocaleString('en-IN')} ceiling</span>
          </div>
        </div>
      </div>

      {/* Downstream Compatibility Alerts (if any decisions are flagged) */}
      {flaggedDecisions.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-5">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900 mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Active Dependency & Downstream Review Flags ({flaggedDecisions.length})</span>
          </div>
          <p className="text-xs text-amber-800 mb-3">
            The following decisions have been flagged by the Decizy engine because a prerequisite or related upstream specification was changed.
          </p>
          <div className="space-y-2">
            {flaggedDecisions.map((dec) => (
              <div
                key={dec.id}
                className="bg-white border border-amber-200 rounded-lg p-3 text-xs flex flex-wrap items-center justify-between gap-2"
              >
                <div>
                  <span className="font-mono font-bold text-stone-900">{dec.typeCode}</span>
                  <span className="mx-2 text-stone-300">|</span>
                  <span className="font-semibold text-stone-800">{dec.title}</span>
                  <p className="text-amber-800 text-[11px] mt-0.5">{dec.reviewFlagReason}</p>
                </div>
                <button
                  onClick={() => onNavigate('decisions')}
                  className="px-3 py-1 text-xs font-medium bg-amber-100 hover:bg-amber-200 text-amber-900 rounded transition-colors whitespace-nowrap"
                >
                  Verify Impact
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Two Column Grid: Pending Decision Queue vs Risk Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column (7 Cols): Decisions Awaiting Signoff */}
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                Critical Path Decisions Awaiting Sign-Off
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Approvals required to prevent contractor and fabrication stoppages.
              </p>
            </div>
            <button
              onClick={() => onNavigate('decisions')}
              className="text-xs font-medium text-stone-600 hover:text-stone-900 flex items-center gap-1"
            >
              <span>View all</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3 divide-y divide-stone-100">
            {pendingApprovals.length === 0 ? (
              <div className="py-8 text-center text-xs text-stone-500">
                All scheduled decisions for this project are currently approved.
              </div>
            ) : (
              pendingApprovals.map((dec) => (
                <div key={dec.id} className="pt-3 first:pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-stone-900">
                        {dec.typeCode}
                      </span>
                      <span className="text-xs font-semibold text-stone-800">{dec.title}</span>
                    </div>
                    <span className="font-mono text-xs tabular-nums font-semibold text-stone-900">
                      ₹{dec.costImpactINR.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <p className="text-stone-600 text-xs mt-1">{dec.currentOption}</p>

                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-stone-500">
                    <div>
                      <span>Deadline: {dec.deadlineDate}</span>
                      <span aria-hidden="true" className="mx-1.5">
                        ·
                      </span>
                      <span className="font-semibold text-amber-700">{dec.urgency} Urgency</span>
                    </div>
                    <button
                      onClick={() => onNavigate('decisions')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-stone-900 bg-stone-100 hover:bg-stone-200 rounded transition-colors"
                    >
                      Review Options
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column (5 Cols): Risk Radar & Milestone Health */}
        <div className="lg:col-span-5 space-y-6">
          {/* Milestone Health */}
          <div className="bg-white border border-stone-200 rounded-xl p-6 shadow-xs">
            <h2 className="text-base font-bold text-stone-900 mb-1">
              Architecture Delivery Health
            </h2>
            <p className="text-xs text-stone-500 mb-4">
              Project schedule: {selectedProject?.startDate} to {selectedProject?.targetCompletionDate}
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-stone-700">Concept & Zoning</span>
                  <span className="font-mono text-stone-500">100% Locked</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-stone-900 h-2 rounded-full w-full" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-stone-700">Civil & Structural Works</span>
                  <span className="font-mono text-stone-500">80% Locked</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-stone-900 h-2 rounded-full w-4/5" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-stone-700">MEP Services & HVAC</span>
                  <span className="font-mono text-stone-500">65% Locked</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-stone-900 h-2 rounded-full w-[65%]" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-stone-700">Materials, Finishes & Joinery</span>
                  <span className="font-mono text-stone-500">40% Locked</span>
                </div>
                <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-stone-900 h-2 rounded-full w-2/5" />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Intake Banner */}
          <div className="bg-stone-900 text-stone-100 rounded-xl p-6 shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Free Intake Screening</span>
            </div>
            <h3 className="text-base font-bold">New Project A0 Decision Check</h3>
            <p className="text-xs text-stone-300 leading-relaxed">
              Screening tool for early risk detection before hiring contractors or committing heavy procurement capital.
            </p>
            <button
              onClick={() => onNavigate('a0-check')}
              className="px-4 py-2 text-xs font-semibold text-stone-900 bg-white hover:bg-stone-100 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <span>Launch A0 Intake Form</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
