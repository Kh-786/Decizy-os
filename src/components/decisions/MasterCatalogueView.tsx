import React, { useState } from 'react';
import { MASTER_DECISION_TYPES, MASTER_DECISION_CATEGORIES } from '../../data/masterDecisions';
import { MasterDecisionType, ProjectStage, UserRole } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Search, Filter, ShieldAlert, ArrowRight, CheckCircle2, ChevronRight, Edit3 } from 'lucide-react';

export const MasterCatalogueView: React.FC = () => {
  const { activeRole } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDecision, setSelectedDecision] = useState<MasterDecisionType | null>(
    MASTER_DECISION_TYPES[0]
  );
  const [catalogueItems, setCatalogueItems] = useState<MasterDecisionType[]>(MASTER_DECISION_TYPES);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<MasterDecisionType>>({});

  const filteredItems = catalogueItems.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleStartEdit = (item: MasterDecisionType) => {
    setEditFormData(item);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    if (!editFormData.code) return;
    setCatalogueItems((prev) =>
      prev.map((item) => (item.code === editFormData.code ? ({ ...item, ...editFormData, version: item.version + 1 } as MasterDecisionType) : item))
    );
    if (selectedDecision?.code === editFormData.code) {
      setSelectedDecision({ ...selectedDecision, ...editFormData, version: (selectedDecision.version || 1) + 1 } as MasterDecisionType);
    }
    setIsEditing(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
            <span>Module D</span>
            <span aria-hidden="true">·</span>
            <span>Architecture & Interior Standards</span>
            <span aria-hidden="true">·</span>
            <span className="font-semibold text-stone-900">33 Master Decisions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Master Decision Types Catalogue
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Pre-engineered dependency matrix and risk criteria covering initial spatial zoning through to pre-handover snag retention.
          </p>
        </div>

        {activeRole === 'admin' && (
          <div className="text-xs bg-amber-50 text-amber-900 px-3 py-1.5 rounded-lg border border-amber-200">
            <span className="font-semibold">Admin Mode:</span> You have permission to edit decision rules and seed specifications.
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-stone-200 rounded-xl p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Category Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setSelectedCategory('All')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
              selectedCategory === 'All'
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:text-stone-900'
            }`}
          >
            All Categories ({catalogueItems.length})
          </button>
          {MASTER_DECISION_CATEGORIES.map((cat) => {
            const count = catalogueItems.filter((i) => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  selectedCategory === cat
                    ? 'bg-stone-900 text-white'
                    : 'bg-stone-100 text-stone-600 hover:text-stone-900'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search code, name, keyword..."
            className="w-full text-xs pl-9 pr-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-500"
          />
        </div>
      </div>

      {/* Two-Column Split: Master List on Left, Detail Dossier on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List (5 Cols) */}
        <div className="lg:col-span-5 bg-white border border-stone-200 rounded-xl overflow-hidden shadow-xs divide-y divide-stone-100 max-h-[800px] overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-stone-500">
              No master decision matches your search criteria.
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedDecision?.code === item.code;
              return (
                <div
                  key={item.code}
                  onClick={() => {
                    setSelectedDecision(item);
                    setIsEditing(false);
                  }}
                  className={`p-4 cursor-pointer transition-colors text-left ${
                    isSelected ? 'bg-stone-100/80 border-l-2 border-stone-900' : 'hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-stone-900">
                      {item.code}
                    </span>
                    <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                      <span>{item.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">{item.impact} Impact</span>
                    </div>
                  </div>
                  <h3 className="text-xs font-semibold text-stone-800 mt-1 line-clamp-1">
                    {item.name}
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-stone-400">
                    <span>Role: {item.responsibleRole}</span>
                    <span>v{item.version}.0</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Detail Dossier (7 Cols) */}
        <div className="lg:col-span-7 bg-white border border-stone-200 rounded-xl p-6 sm:p-8 shadow-xs">
          {selectedDecision ? (
            <div>
              {/* Header */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-100 pb-5">
                <div>
                  <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider">
                    <span className="font-bold text-stone-900">{selectedDecision.code}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedDecision.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>v{selectedDecision.version}.0</span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-stone-900 mt-1">
                    {selectedDecision.name}
                  </h2>
                </div>

                {activeRole === 'admin' && !isEditing && (
                  <button
                    onClick={() => handleStartEdit(selectedDecision)}
                    className="px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Definition</span>
                  </button>
                )}
              </div>

              {isEditing ? (
                /* Admin Edit Form */
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Decision Name
                    </label>
                    <input
                      type="text"
                      value={editFormData.name || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Description
                    </label>
                    <textarea
                      rows={3}
                      value={editFormData.description || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, description: e.target.value })
                      }
                      className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Suggested Next Action
                    </label>
                    <input
                      type="text"
                      value={editFormData.suggestedNextAction || ''}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, suggestedNextAction: e.target.value })
                      }
                      className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={handleSaveEdit}
                      className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 rounded-lg hover:bg-stone-800"
                    >
                      Save Catalogue Revision
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-xs font-medium text-stone-600 bg-stone-100 rounded-lg hover:bg-stone-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Read-Only Spec Dossier */
                <div className="mt-6 space-y-6 text-xs">
                  {/* Overview */}
                  <div>
                    <h3 className="font-semibold text-stone-800 uppercase tracking-wider text-[11px] mb-2">
                      Scope & Engineering Rationale
                    </h3>
                    <p className="text-stone-600 leading-relaxed text-sm">
                      {selectedDecision.description}
                    </p>
                  </div>

                  {/* Technical Coordinates Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-stone-50 rounded-xl border border-stone-200/70">
                    <div>
                      <span className="text-stone-500 block text-[11px]">Impact</span>
                      <span className="font-bold text-stone-900">{selectedDecision.impact}</span>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[11px]">Urgency</span>
                      <span className="font-bold text-stone-900">{selectedDecision.urgency}</span>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[11px]">Lead Role</span>
                      <span className="font-bold text-stone-900 capitalize">
                        {selectedDecision.responsibleRole.replace('_', ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-stone-500 block text-[11px]">Relevant Stages</span>
                      <span className="font-bold text-stone-900">
                        {selectedDecision.stages.join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Prerequisites / Dependencies */}
                  <div>
                    <h3 className="font-semibold text-stone-800 uppercase tracking-wider text-[11px] mb-2">
                      Prerequisites & Upstream Dependencies
                    </h3>
                    {selectedDecision.dependencies.length === 0 ? (
                      <p className="text-stone-500 italic">
                        Root-level decision. No upstream dependencies required.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedDecision.dependencies.map((depCode) => {
                          const dep = catalogueItems.find((c) => c.code === depCode);
                          return (
                            <div
                              key={depCode}
                              onClick={() => dep && setSelectedDecision(dep)}
                              className="p-2.5 bg-stone-100 hover:bg-stone-200 rounded-lg cursor-pointer transition-colors border border-stone-200"
                            >
                              <span className="font-mono font-bold text-stone-900">{depCode}</span>
                              <span className="text-stone-600 block text-[11px] mt-0.5">
                                {dep?.name || 'Upstream Specification'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Inputs & Outputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 border border-stone-200 rounded-xl">
                      <h4 className="font-bold text-stone-900 mb-2">Required Inputs</h4>
                      <ul className="space-y-1 text-stone-600">
                        {selectedDecision.requiredInputs.map((input, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-stone-400">·</span>
                            <span>{input}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 border border-stone-200 rounded-xl">
                      <h4 className="font-bold text-stone-900 mb-2">Expected Deliverables</h4>
                      <ul className="space-y-1 text-stone-600">
                        {selectedDecision.expectedOutputs.map((output, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <span className="text-stone-400">·</span>
                            <span>{output}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Risk Indicators */}
                  <div>
                    <h3 className="font-semibold text-stone-800 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5 text-rose-800">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span>Known Risk Indicators</span>
                    </h3>
                    <ul className="space-y-1.5 text-stone-700 bg-rose-50/40 border border-rose-100 p-4 rounded-xl">
                      {selectedDecision.riskIndicators.map((risk, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-rose-500 font-bold">!</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Approval Requirements & Suggested Action */}
                  <div className="p-4 bg-stone-900 text-stone-100 rounded-xl space-y-2">
                    <div className="text-[11px] font-mono text-stone-400 uppercase">
                      Suggested Action
                    </div>
                    <div className="text-sm font-medium text-stone-100">
                      {selectedDecision.suggestedNextAction}
                    </div>
                    <div className="pt-2 border-t border-stone-800 text-[11px] text-stone-400">
                      Sign-off Rule: {selectedDecision.approvalRequirements}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-xs text-stone-500 py-12">
              Select a decision type from the catalogue to view its engineering specifications.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
