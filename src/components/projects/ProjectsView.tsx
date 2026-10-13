import React, { useState } from 'react';
import { useProjects } from '../../context/ProjectContext';
import { useAuth } from '../../context/AuthContext';
import { Project, ProjectType, ProjectStage } from '../../types';
import {
  FolderKanban,
  Plus,
  Building,
  Calendar,
  FileText,
  DollarSign,
  User,
  ArrowRight,
  Download,
  Upload,
} from 'lucide-react';

export const ProjectsView: React.FC = () => {
  const {
    projects,
    selectedProject,
    setSelectedProjectId,
    decisions,
    documents,
    createProjectAction,
  } = useProjects();
  const { currentUser, activeRole } = useAuth();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCity, setNewCity] = useState('Bengaluru');
  const [newType, setNewType] = useState<ProjectType>('Residential');
  const [newAreaSqFt, setNewAreaSqFt] = useState<number>(2000);
  const [newBudgetINR, setNewBudgetINR] = useState<number>(6000000);
  const [newCustomerName, setNewCustomerName] = useState('');

  const projectDecisions = decisions.filter(
    (d) => d.projectId === selectedProject?.id
  );

  const projectDocs = documents.filter(
    (doc) => doc.projectId === selectedProject?.id
  );

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCustomerName.trim()) return;

    const code = `PRJ-${newCity.slice(0, 3).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    createProjectAction({
      code,
      title: newTitle,
      description: `Interior design and architecture project in ${newCity}.`,
      type: newType,
      stage: 'Planning',
      city: newCity,
      areaSqFt: newAreaSqFt,
      budgetINR: newBudgetINR,
      spentINR: 0,
      customerName: newCustomerName,
      customerId: currentUser.role === 'customer' ? currentUser.id : 'usr-cust-new',
      designerName: 'Ar. Priya Sundaram',
      designerId: 'usr-des-01',
      projectManagerName: 'Karan Sen',
      projectManagerId: 'usr-pm-01',
      serviceTier: 'B1',
      startDate: new Date().toISOString().split('T')[0],
      targetCompletionDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0],
    });

    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewCustomerName('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
            <span>Module B & I</span>
            <span aria-hidden="true">·</span>
            <span>Project Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
            Architecture & Interior Projects
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Active engagements under Decizy decision intelligence management.
          </p>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg flex items-center gap-1.5 transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Project</span>
        </button>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((proj) => {
          const isSelected = selectedProject?.id === proj.id;
          return (
            <div
              key={proj.id}
              onClick={() => setSelectedProjectId(proj.id)}
              className={`bg-white border rounded-xl p-5 cursor-pointer transition-all ${
                isSelected
                  ? 'border-stone-900 ring-1 ring-stone-900 shadow-md'
                  : 'border-stone-200 hover:border-stone-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between font-mono text-[11px] text-stone-500">
                <span className="font-bold text-stone-900">{proj.code}</span>
                <span className="capitalize">{proj.stage}</span>
              </div>

              <h2 className="text-base font-bold text-stone-900 mt-2 line-clamp-1">
                {proj.title}
              </h2>
              <p className="text-xs text-stone-600 mt-1 line-clamp-2">{proj.description}</p>

              <div className="mt-4 pt-4 border-t border-stone-100 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-stone-400 block text-[11px]">Location</span>
                  <span className="font-medium text-stone-800">{proj.city}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Area</span>
                  <span className="font-medium text-stone-800 font-mono tabular-nums">
                    {proj.areaSqFt.toLocaleString('en-IN')} sq.ft
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Budget (INR)</span>
                  <span className="font-semibold text-stone-900 font-mono tabular-nums">
                    ₹{proj.budgetINR.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Service Tier</span>
                  <span className="font-bold text-amber-700">Tier {proj.serviceTier}</span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-[11px] text-stone-500">
                <span>Client: {proj.customerName}</span>
                <span className="font-semibold text-stone-900 flex items-center gap-1">
                  <span>{isSelected ? 'Viewing' : 'Select'}</span>
                  <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Project In-Depth Dossier */}
      {selectedProject && (
        <div className="bg-white border border-stone-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase">
                <span className="font-bold text-stone-900">{selectedProject.code}</span>
                <span aria-hidden="true">·</span>
                <span>Tier {selectedProject.serviceTier}</span>
                <span aria-hidden="true">·</span>
                <span>Stage: {selectedProject.stage}</span>
              </div>
              <h2 className="text-xl font-bold tracking-tight text-stone-900 mt-1">
                {selectedProject.title} — Technical Project Dossier
              </h2>
            </div>
            <div className="text-xs text-stone-500 text-right">
              <div>Target Completion</div>
              <div className="font-mono tabular-nums font-bold text-stone-900">
                {selectedProject.targetCompletionDate}
              </div>
            </div>
          </div>

          {/* Project Stakeholders */}
          <div>
            <h3 className="font-bold uppercase tracking-wider text-stone-800 text-[11px] mb-3">
              Project Stakeholders & Authorized Team
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-stone-500 block text-[11px]">Project Owner / Customer</span>
                <div className="font-bold text-stone-900 mt-0.5">{selectedProject.customerName}</div>
                <div className="text-[11px] text-stone-500">Authorized for cost & aesthetic sign-off</div>
              </div>
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-stone-500 block text-[11px]">Lead Architect / Designer</span>
                <div className="font-bold text-stone-900 mt-0.5">{selectedProject.designerName}</div>
                <div className="text-[11px] text-stone-500">Design options, RCP, material palettes</div>
              </div>
              <div className="p-3 bg-stone-50 rounded-lg border border-stone-200">
                <span className="text-stone-500 block text-[11px]">Project Manager (Site & MEP)</span>
                <div className="font-bold text-stone-900 mt-0.5">{selectedProject.projectManagerName}</div>
                <div className="text-[11px] text-stone-500">Civil verification, timelines & snagging</div>
              </div>
            </div>
          </div>

          {/* Project Documents Archive */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold uppercase tracking-wider text-stone-800 text-[11px]">
                Technical Drawings, BOQ & Approvals Dossier ({projectDocs.length})
              </h3>
              <span className="text-[11px] text-stone-500 font-mono">Storage: Supabase Ready</span>
            </div>

            <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden">
              {projectDocs.length === 0 ? (
                <div className="p-6 text-center text-xs text-stone-500">
                  No documents attached to this project yet.
                </div>
              ) : (
                projectDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="p-3.5 bg-white hover:bg-stone-50 transition-colors flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-4 h-4 text-stone-500 shrink-0" />
                      <div>
                        <span className="font-semibold text-stone-900">{doc.name}</span>
                        <div className="text-[11px] text-stone-500 flex items-center gap-2 mt-0.5">
                          <span>{doc.type}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {(doc.sizeBytes / 1024 / 1024).toFixed(2)} MB
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Uploaded by {doc.uploadedBy}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-stone-400">v{doc.version}.0</span>
                      <button
                        onClick={() => alert(`Simulated document inspection for: ${doc.name}`)}
                        className="p-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded"
                        title="Download / View Document"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* New Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs">
          <form
            onSubmit={handleCreateProject}
            className="bg-white border border-stone-200 rounded-2xl max-w-md w-full p-6 shadow-xl text-xs space-y-4"
          >
            <div>
              <h3 className="text-lg font-bold text-stone-900">Initiate New Project</h3>
              <p className="text-stone-600 text-[11px] mt-0.5">
                Register a new architecture or interior project under Decizy management.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Project Title <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Indiranagar Modern Residence"
                className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Customer / Project Owner Name <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                required
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="e.g. Rahul & Sneha Kapoor"
                className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">City</label>
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Type</label>
                <select
                  value={newType}
                  onChange={(e) => setNewType(e.target.value as ProjectType)}
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg bg-white"
                >
                  <option value="Residential">Residential</option>
                  <option value="Commercial">Commercial</option>
                  <option value="Hospitality">Hospitality</option>
                  <option value="Retail">Retail</option>
                  <option value="Office">Office</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Area (Sq.Ft)</label>
                <input
                  type="number"
                  value={newAreaSqFt}
                  onChange={(e) => setNewAreaSqFt(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-stone-700 mb-1">Budget (INR)</label>
                <input
                  type="number"
                  step={100000}
                  value={newBudgetINR}
                  onChange={(e) => setNewBudgetINR(parseInt(e.target.value, 10) || 0)}
                  className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg"
              >
                Create Project
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
