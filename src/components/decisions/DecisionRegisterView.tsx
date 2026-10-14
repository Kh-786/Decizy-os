import React, { useState } from 'react';
import { useProjects } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { ProjectDecision, DecisionStatus, UrgencyLevel, ImpactLevel } from '../../types';
import {
  CheckCircle2,
  AlertTriangle,
  Clock,
  GitBranch,
  ArrowRight,
  XCircle,
  FileText,
  RefreshCw,
  Search,
  Filter,
  DollarSign,
  History,
  AlertCircle,
} from 'lucide-react';

export const DecisionRegisterView: React.FC = () => {
  const {
    selectedProject,
    decisions,
    projects,
    setSelectedProjectId,
    approveDecisionAction,
    rejectDecisionAction,
    submitForReviewAction,
    applyMaterialChangeAction,
  } = useProjects();
  const { currentUser, activeRole } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedDecision, setSelectedDecision] = useState<ProjectDecision | null>(null);

  // Material revision form modal state
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [newOptionInput, setNewOptionInput] = useState('');
  const [revisionRationaleInput, setRevisionRationaleInput] = useState('');
  const [costDeltaInput, setCostDeltaInput] = useState<number>(0);
  const [timeDeltaInput, setTimeDeltaInput] = useState<number>(0);
  const [revisionAlertMessage, setRevisionAlertMessage] = useState<string | null>(null);

  // Reject / Changes requested modal state
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  const projectDecisions = decisions.filter(
    (d) => d.projectId === selectedProject?.id
  );

  const filteredDecisions = projectDecisions.filter((dec) => {
    const matchesStatus = statusFilter === 'All' || dec.status === statusFilter;
    const matchesSearch =
      dec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dec.typeCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dec.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dec.currentOption.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const handleApprove = async (decision: ProjectDecision, optionTitle: string) => {
    await approveDecisionAction(
      decision.id,
      { id: currentUser.id, name: currentUser.fullName, role: currentUser.role },
      optionTitle,
      `Approved formally by ${currentUser.fullName} (${currentUser.role}).`
    );
    // Refresh modal with updated data
    const updated = decisions.find((d) => d.id === decision.id);
    if (updated) setSelectedDecision(updated);
  };

  const handleReject = async () => {
    if (!selectedDecision || !rejectReasonInput.trim()) return;
    await rejectDecisionAction(
      selectedDecision.id,
      { id: currentUser.id, name: currentUser.fullName, role: currentUser.role },
      rejectReasonInput,
      false
    );
    setIsRejectModalOpen(false);
    setRejectReasonInput('');
  };

  const handleApplyMaterialChange = async () => {
    if (!selectedDecision || !newOptionInput.trim() || !revisionRationaleInput.trim()) return;

    const result = await applyMaterialChangeAction(
      selectedDecision.id,
      { id: currentUser.id, name: currentUser.fullName, role: currentUser.role },
      {
        newOption: newOptionInput,
        rationale: revisionRationaleInput,
        costDeltaINR: costDeltaInput,
        timeDeltaDays: timeDeltaInput,
      }
    );

    setRevisionAlertMessage(result.message);
    setIsRevisionModalOpen(false);
    setNewOptionInput('');
    setRevisionRationaleInput('');
    setCostDeltaInput(0);
    setTimeDeltaInput(0);
  };

  const statusColors: Record<DecisionStatus, { text: string; bg: string }> = {
    Draft: { text: 'text-stone-600', bg: 'bg-stone-100' },
    Submitted: { text: 'text-blue-700', bg: 'bg-blue-50' },
    'Under Review': { text: 'text-amber-700', bg: 'bg-amber-50' },
    'Changes Requested': { text: 'text-orange-700', bg: 'bg-orange-50' },
    Approved: { text: 'text-emerald-700', bg: 'bg-emerald-50' },
    Rejected: { text: 'text-rose-700', bg: 'bg-rose-50' },
    Superseded: { text: 'text-stone-500', bg: 'bg-stone-100' },
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Bar / Project Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
            <span>Module D & E</span>
            <span aria-hidden="true">·</span>
            <span>Decision Intelligence Register</span>
            <span aria-hidden="true">·</span>
            <span>{selectedProject?.code}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Project Decision Register
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Active decisions, dependency locks, formal sign-offs, and downstream change-impact propagation.
          </p>
        </div>

        {/* Project Selector dropdown */}
        <div className="flex items-center gap-2 bg-white border border-stone-200 rounded-lg p-1.5 shadow-xs">
          <span className="text-xs text-stone-500 pl-2 font-medium">Active Project:</span>
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
      </div>

      {/* Revision alert banner if triggered */}
      {revisionAlertMessage && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 flex items-start justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Downstream Impact Flagged:</span>
              <p className="mt-0.5 text-amber-800">{revisionAlertMessage}</p>
            </div>
          </div>
          <button
            onClick={() => setRevisionAlertMessage(null)}
            className="text-amber-700 hover:text-amber-900 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Status filter tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['All', 'Under Review', 'Changes Requested', 'Approved', 'Draft'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                statusFilter === status
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:text-stone-900'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search decisions, options, codes..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
        </div>
      </div>

      {/* Decision Table */}
      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-stone-200 bg-stone-50/80 text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Decision Title & Category</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Selected / Recommended Option</th>
                <th className="py-3 px-4 text-right">Cost (INR)</th>
                <th className="py-3 px-4">Urgency</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {filteredDecisions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-stone-500 text-xs">
                    No decisions found for the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDecisions.map((dec) => {
                  const statusStyle = statusColors[dec.status] || {
                    text: 'text-stone-600',
                    bg: 'bg-stone-100',
                  };

                  return (
                    <tr
                      key={dec.id}
                      className={`hover:bg-stone-50/80 transition-colors ${
                        dec.flaggedForReview ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {dec.flaggedForReview && (
                            <span
                              title={dec.reviewFlagReason}
                              className="text-amber-600 font-bold cursor-help"
                            >
                              ⚠
                            </span>
                          )}
                          <span>{dec.typeCode}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-stone-900">{dec.title}</div>
                        <div className="text-[11px] text-stone-500 mt-0.5">
                          {dec.category} · Assigned to: {dec.assigneeName}
                        </div>
                        {dec.flaggedForReview && (
                          <div className="mt-1 text-[11px] text-amber-800 font-medium bg-amber-100/60 p-1 rounded">
                            {dec.reviewFlagReason}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${statusStyle.text} ${statusStyle.bg}`}
                        >
                          {dec.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-stone-700">
                        {dec.currentOption}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-stone-900 whitespace-nowrap">
                        ₹{dec.costImpactINR.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`text-[11px] font-semibold ${
                            dec.urgency === 'Critical'
                              ? 'text-rose-700'
                              : dec.urgency === 'High'
                              ? 'text-amber-700'
                              : 'text-stone-600'
                          }`}
                        >
                          {dec.urgency}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <button
                          onClick={() => setSelectedDecision(dec)}
                          className="px-3 py-1 text-xs font-medium text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                        >
                          Review & Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Decision Detail & Review Modal */}
      {selectedDecision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-3xl w-full p-6 sm:p-8 shadow-xl max-h-[90vh] overflow-y-auto text-xs">
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-4">
              <div>
                <div className="flex items-center gap-2 font-mono text-[11px] text-stone-500 uppercase">
                  <span className="font-bold text-stone-900">{selectedDecision.typeCode}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedDecision.category}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-stone-800">{selectedDecision.status}</span>
                </div>
                <h2 className="text-xl font-bold tracking-tight text-stone-900 mt-1">
                  {selectedDecision.title}
                </h2>
              </div>
              <button
                onClick={() => setSelectedDecision(null)}
                className="text-stone-400 hover:text-stone-700 text-lg p-1"
              >
                ✕
              </button>
            </div>

            {/* Flagged Alert Banner inside modal if applicable */}
            {selectedDecision.flaggedForReview && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">Compatibility Verification Alert:</span>
                  <p className="mt-0.5 text-amber-800">{selectedDecision.reviewFlagReason}</p>
                </div>
              </div>
            )}

            {/* Content Options */}
            <div className="mt-6 space-y-6">
              <div>
                <h3 className="font-bold uppercase tracking-wider text-stone-800 text-[11px] mb-3">
                  Evaluated Design & Technical Options
                </h3>
                <div className="space-y-3">
                  {selectedDecision.optionsConsidered.map((opt) => {
                    const isSelected = selectedDecision.currentOption === opt.title;
                    return (
                      <div
                        key={opt.id}
                        className={`p-4 rounded-xl border transition-all ${
                          isSelected
                            ? 'border-stone-900 bg-stone-50/80 ring-1 ring-stone-900'
                            : 'border-stone-200 bg-white hover:border-stone-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-900">{opt.title}</span>
                            {opt.isRecommended && (
                              <span className="text-[10px] uppercase font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                                Recommended
                              </span>
                            )}
                          </div>
                          <span className="font-mono tabular-nums font-bold text-stone-900">
                            ₹{opt.estimatedCostINR.toLocaleString('en-IN')}
                          </span>
                        </div>

                        <p className="text-stone-600 mt-2 leading-relaxed">{opt.description}</p>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="font-semibold text-emerald-800 block mb-1">
                              Engineering Advantages:
                            </span>
                            <ul className="list-disc list-inside text-stone-600 space-y-0.5">
                              {opt.pros.map((pro, i) => (
                                <li key={i}>{pro}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="font-semibold text-rose-800 block mb-1">
                              Trade-offs / Constraints:
                            </span>
                            <ul className="list-disc list-inside text-stone-600 space-y-0.5">
                              {opt.cons.map((con, i) => (
                                <li key={i}>{con}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Interactive Approval Trigger */}
                        {selectedDecision.status !== 'Approved' && (
                          <div className="mt-4 pt-3 border-t border-stone-200 flex justify-end">
                            <button
                              onClick={() => handleApprove(selectedDecision, opt.title)}
                              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg flex items-center gap-1.5 transition-colors"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Select & Approve Option</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Dependency Chain Display */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200">
                <h3 className="font-bold uppercase tracking-wider text-stone-800 text-[11px] mb-2 flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-stone-600" />
                  <span>Dependency Linkage</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-stone-500 block text-[11px]">
                      Prerequisite Decisions (Must Be Locked First):
                    </span>
                    {selectedDecision.dependencies.length === 0 ? (
                      <span className="text-stone-400 italic">None (Root decision)</span>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedDecision.dependencies.map((dep) => (
                          <span
                            key={dep}
                            className="font-mono text-[11px] bg-white border border-stone-300 px-2 py-0.5 rounded text-stone-700"
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">
                      Downstream Dependents (Waiting on This):
                    </span>
                    {selectedDecision.dependents.length === 0 ? (
                      <span className="text-stone-400 italic">None</span>
                    ) : (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {selectedDecision.dependents.map((dep) => (
                          <span
                            key={dep}
                            className="font-mono text-[11px] bg-white border border-stone-300 px-2 py-0.5 rounded text-stone-700"
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Version History & Revisions Log */}
              <div>
                <h3 className="font-bold uppercase tracking-wider text-stone-800 text-[11px] mb-2 flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-stone-600" />
                  <span>Immutable Revision Audit Log ({selectedDecision.revisions.length})</span>
                </h3>
                {selectedDecision.revisions.length === 0 ? (
                  <p className="text-stone-500 italic">
                    Original specification baseline (No revisions applied yet).
                  </p>
                ) : (
                  <div className="space-y-2 divide-y divide-stone-100">
                    {selectedDecision.revisions.map((rev) => (
                      <div key={rev.id} className="pt-2 first:pt-0">
                        <div className="flex items-center justify-between font-mono text-[11px]">
                          <span className="font-bold text-stone-900">
                            Rev #{rev.revisionNumber} · {rev.status}
                          </span>
                          <span className="text-stone-400 tabular-nums">
                            {new Date(rev.createdAt).toLocaleDateString('en-IN')}
                          </span>
                        </div>
                        <p className="text-stone-700 mt-0.5 font-medium">{rev.description}</p>
                        <p className="text-stone-500 mt-0.5 text-[11px]">
                          Rationale: "{rev.rationale}" — Signed by {rev.changedByName} ({rev.changedByRole})
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="mt-6 pt-4 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Apply Material Change Button */}
                <button
                  onClick={() => setIsRevisionModalOpen(true)}
                  className="px-3.5 py-2 text-xs font-medium text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-stone-600" />
                  <span>Apply Material Change</span>
                </button>

                {/* Reject / Request Changes Button */}
                {selectedDecision.status !== 'Changes Requested' &&
                  selectedDecision.status !== 'Rejected' && (
                    <button
                      onClick={() => setIsRejectModalOpen(true)}
                      className="px-3.5 py-2 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Request Changes</span>
                    </button>
                  )}
              </div>

              <button
                onClick={() => setSelectedDecision(null)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Material Revision Prompt Modal */}
      {isRevisionModalOpen && selectedDecision && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-xs space-y-4">
            <div>
              <div className="text-[11px] font-mono text-amber-700 uppercase font-bold">
                Change-Impact Control
              </div>
              <h3 className="text-lg font-bold text-stone-900 mt-0.5">
                Apply Material Change to {selectedDecision.typeCode}
              </h3>
              <p className="text-stone-600 text-[11px] mt-1">
                Material changes to approved or active specifications will create a formal revision
                and automatically flag all downstream dependent decisions for engineering review.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                New Specification or Option Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                value={newOptionInput}
                onChange={(e) => setNewOptionInput(e.target.value)}
                placeholder="e.g. Sintered Porcelain Slabs 1600x3200mm (Nexion) instead of Marble"
                className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Material Rationale & Justification <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                value={revisionRationaleInput}
                onChange={(e) => setRevisionRationaleInput(e.target.value)}
                placeholder="e.g. Quarry lead time delayed by 6 weeks; client requested stain-proof porcelain with zero maintenance."
                className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Cost Delta INR (±)
                </label>
                <input
                  type="number"
                  value={costDeltaInput}
                  onChange={(e) => setCostDeltaInput(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. -600000 or +250000"
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">
                  Time Delta Days (±)
                </label>
                <input
                  type="number"
                  value={timeDeltaInput}
                  onChange={(e) => setTimeDeltaInput(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 5"
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setIsRevisionModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyMaterialChange}
                disabled={!newOptionInput.trim() || !revisionRationaleInput.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-lg"
              >
                Commit Revision & Flag Dependents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject / Request Changes Modal */}
      {isRejectModalOpen && selectedDecision && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/70 backdrop-blur-xs">
          <div className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-2xl text-xs space-y-4">
            <div>
              <h3 className="text-lg font-bold text-stone-900">
                Request Changes on {selectedDecision.typeCode}
              </h3>
              <p className="text-stone-600 text-[11px] mt-1">
                Provide technical or aesthetic reasons to return this decision to the design team.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Technical Feedback / Rejection Note <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="e.g. Please bring sample of Dekton Laurent to site for turmeric and hot cooker test before sign-off."
                className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectReasonInput.trim()}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-700 hover:bg-rose-800 disabled:opacity-50 rounded-lg"
              >
                Submit Feedback
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
