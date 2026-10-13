import React, { useState } from 'react';
import { useProjects } from '../../context/ProjectContext';
import { a0AssessmentSchema, A0AssessmentFormData } from '../../lib/validation';
import { A0Assessment, ProjectType, ProjectStage } from '../../types';
import { CheckCircle2, AlertTriangle, ArrowRight, ShieldCheck, Sparkles, FileText } from 'lucide-react';

export const A0AssessmentView: React.FC = () => {
  const { submitA0Assessment, assessments } = useProjects();

  const [formData, setFormData] = useState<A0AssessmentFormData>({
    fullName: '',
    email: '',
    phone: '',
    projectType: 'Residential',
    projectCity: '',
    postalCode: '',
    approximateAreaSqFt: 1800,
    projectStage: 'Planning',
    budgetRangeINR: '₹30L – ₹60L',
    primaryChallenge: '',
    decisionNeededSoon: true,
    contactConsent: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<A0Assessment | null>(null);

  const budgetOptions = [
    'Under ₹15 Lakhs',
    '₹15L – ₹30L',
    '₹30L – ₹60L',
    '₹60L – ₹1.2 Cr',
    '₹1.2 Cr – ₹2.5 Cr',
    '₹2.5 Cr – ₹5 Cr',
    '₹5 Cr+',
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = a0AssessmentSchema.safeParse(formData);

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0] !== undefined) {
          fieldErrors[String(err.path[0])] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    // Simulate safe processing latency
    setTimeout(() => {
      const newAssessment = submitA0Assessment({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone || undefined,
        projectType: formData.projectType,
        projectCity: formData.projectCity,
        postalCode: formData.postalCode || undefined,
        approximateAreaSqFt: formData.approximateAreaSqFt,
        projectStage: formData.projectStage,
        budgetRangeINR: formData.budgetRangeINR,
        primaryChallenge: formData.primaryChallenge,
        decisionNeededSoon: formData.decisionNeededSoon,
        contactConsent: formData.contactConsent,
      });

      setSubmittedResult(newAssessment);
      setIsSubmitting(false);
    }, 600);
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      projectType: 'Residential',
      projectCity: '',
      postalCode: '',
      approximateAreaSqFt: 1800,
      projectStage: 'Planning',
      budgetRangeINR: '₹30L – ₹60L',
      primaryChallenge: '',
      decisionNeededSoon: true,
      contactConsent: true,
    });
    setSubmittedResult(null);
    setErrors({});
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
          <span>Module C</span>
          <span aria-hidden="true">·</span>
          <span>Screening Tier A0</span>
          <span aria-hidden="true">·</span>
          <span>AnyRoomz Genesis</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          A0 Decision Check & Project Intake
        </h1>
        <p className="mt-2 text-sm text-stone-600 max-w-3xl">
          Identify critical path decisions, material dependencies, and potential structural/MEP bottlenecks early.
          Screening assessment only; formal architectural and engineering drawings require signed work orders.
        </p>
      </div>

      {submittedResult ? (
        /* Confirmation State */
        <div className="bg-white border border-stone-200 rounded-xl p-8 shadow-xs">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono text-stone-500 uppercase tracking-wider">
                    Intake Reference Code
                  </span>
                  <div className="text-2xl font-bold font-mono tabular-nums text-stone-900 mt-0.5">
                    {submittedResult.referenceNumber}
                  </div>
                </div>
                <div className="text-xs text-stone-500 text-right">
                  <span>Logged at</span>
                  <div className="font-mono tabular-nums font-medium text-stone-700">
                    {new Date(submittedResult.submittedAt).toLocaleString('en-IN', {
                      timeZone: 'Asia/Kolkata',
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-b border-stone-100 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-stone-500 block">Project / City</span>
                  <span className="font-semibold text-stone-800">
                    {submittedResult.projectType} · {submittedResult.projectCity}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Area & Budget</span>
                  <span className="font-semibold text-stone-800 font-mono tabular-nums">
                    {submittedResult.approximateAreaSqFt.toLocaleString('en-IN')} sq.ft · {submittedResult.budgetRangeINR}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block">Initial Risk Evaluation</span>
                  <span className="font-semibold text-amber-700">
                    {submittedResult.riskSummaryScore} Priority Review
                  </span>
                </div>
              </div>

              {/* Recommended First Master Decisions */}
              <div className="mt-6">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-3">
                  Recommended Immediate Decision Checks
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                    <span className="font-mono text-xs font-bold text-stone-900 block">DEC-01</span>
                    <span className="text-xs font-medium text-stone-800 block mt-1">
                      Spatial Zoning & Functional Layout
                    </span>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Freeze room allocations before plumbing or civil work starts.
                    </p>
                  </div>
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                    <span className="font-mono text-xs font-bold text-stone-900 block">DEC-02</span>
                    <span className="text-xs font-medium text-stone-800 block mt-1">
                      Wall Demolition & HOA Bye-Laws
                    </span>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Verify shear walls and get society NOC prior to breaking masonry.
                    </p>
                  </div>
                  <div className="p-3 bg-stone-50 border border-stone-200 rounded-lg">
                    <span className="font-mono text-xs font-bold text-stone-900 block">DEC-11</span>
                    <span className="text-xs font-medium text-stone-800 block mt-1">
                      AC Topology & Power Sanction
                    </span>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Check kVA capacity with electricity board before buying VRV units.
                    </p>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="mt-6 p-4 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">Professional Engineering & Design Disclaimer:</span>
                  <p className="mt-0.5 text-amber-800">
                    A0 Decision Check is an advisory screening to flag sequence conflicts and timeline risks.
                    It does not constitute registered architectural stamps, structural load certifications, or municipal building sanctions.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-medium text-white bg-stone-900 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  Submit Another Assessment
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* The Form */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <form
            onSubmit={handleSubmit}
            noValidate
            className="lg:col-span-8 bg-white border border-stone-200 rounded-xl p-6 sm:p-8 shadow-xs space-y-6"
          >
            {/* Personal Details */}
            <div className="border-b border-stone-100 pb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800 mb-4">
                1. Project Owner Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Vikram Malhotra"
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                      errors.fullName
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-stone-300 focus:ring-stone-500'
                    }`}
                  />
                  {errors.fullName && <p className="text-rose-600 text-[11px] mt-1">{errors.fullName}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Email Address <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. vikram@example.com"
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                      errors.email
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-stone-300 focus:ring-stone-500'
                    }`}
                  />
                  {errors.email && <p className="text-rose-600 text-[11px] mt-1">{errors.email}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Phone (Indian Mobile, Optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="e.g. +91 98200 12345"
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                      errors.phone
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-stone-300 focus:ring-stone-500'
                    }`}
                  />
                  {errors.phone && <p className="text-rose-600 text-[11px] mt-1">{errors.phone}</p>}
                </div>
              </div>
            </div>

            {/* Project Scope */}
            <div className="border-b border-stone-100 pb-6">
              <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800 mb-4">
                2. Project Parameters & Indian Location
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Project Type <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formData.projectType}
                    onChange={(e) =>
                      setFormData({ ...formData, projectType: e.target.value as ProjectType })
                    }
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-500 bg-white"
                  >
                    <option value="Residential">Residential (Apartment/Villa)</option>
                    <option value="Commercial">Commercial (Office/Co-working)</option>
                    <option value="Hospitality">Hospitality (Cafe/Hotel)</option>
                    <option value="Retail">Retail (Boutique/Showroom)</option>
                    <option value="Office">Office Studio</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Project City <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.projectCity}
                    onChange={(e) => setFormData({ ...formData, projectCity: e.target.value })}
                    placeholder="e.g. Bengaluru, Mumbai, Delhi"
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                      errors.projectCity
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-stone-300 focus:ring-stone-500'
                    }`}
                  />
                  {errors.projectCity && (
                    <p className="text-rose-600 text-[11px] mt-1">{errors.projectCity}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    PIN Code (6 Digits)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={formData.postalCode}
                    onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder="e.g. 560066"
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 font-mono tabular-nums ${
                      errors.postalCode
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-stone-300 focus:ring-stone-500'
                    }`}
                  />
                  {errors.postalCode && (
                    <p className="text-rose-600 text-[11px] mt-1">{errors.postalCode}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Approx Area (Sq.Ft) <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="number"
                    min={100}
                    step={50}
                    value={formData.approximateAreaSqFt || ''}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        approximateAreaSqFt: parseInt(e.target.value, 10) || 0,
                      })
                    }
                    className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 font-mono tabular-nums ${
                      errors.approximateAreaSqFt
                        ? 'border-rose-400 focus:ring-rose-500'
                        : 'border-stone-300 focus:ring-stone-500'
                    }`}
                  />
                  {errors.approximateAreaSqFt && (
                    <p className="text-rose-600 text-[11px] mt-1">{errors.approximateAreaSqFt}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Current Stage <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formData.projectStage}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        projectStage: e.target.value as A0AssessmentFormData['projectStage'],
                      })
                    }
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-500 bg-white"
                  >
                    <option value="Planning">Planning & Concept</option>
                    <option value="Design Underway">Design & Drawings Underway</option>
                    <option value="Execution">On-Site Execution</option>
                    <option value="Renovation">Renovation of Existing Space</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Budget Range (INR) <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={formData.budgetRangeINR}
                    onChange={(e) => setFormData({ ...formData, budgetRangeINR: e.target.value })}
                    className="w-full text-xs px-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-500 bg-white"
                  >
                    {budgetOptions.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Challenges & Timeline */}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-stone-800 mb-4">
                3. Primary Bottleneck or Decision Challenge
              </h2>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  What is the most critical decision or doubt facing your project right now?{' '}
                  <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={formData.primaryChallenge}
                  onChange={(e) => setFormData({ ...formData, primaryChallenge: e.target.value })}
                  placeholder="e.g. Trying to decide between VRV centralized AC and split units before ceiling height is finalized, or need to verify if moving bathroom plumbing will leak onto the floor below."
                  className={`w-full text-xs px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                    errors.primaryChallenge
                      ? 'border-rose-400 focus:ring-rose-500'
                      : 'border-stone-300 focus:ring-stone-500'
                  }`}
                />
                {errors.primaryChallenge && (
                  <p className="text-rose-600 text-[11px] mt-1">{errors.primaryChallenge}</p>
                )}
              </div>

              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.decisionNeededSoon}
                    onChange={(e) =>
                      setFormData({ ...formData, decisionNeededSoon: e.target.checked })
                    }
                    className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                  />
                  <span className="text-xs text-stone-700">
                    <span className="font-semibold">Urgent timeline:</span> A decision is needed within the next 7 to 14 days to prevent on-site delays or contractor stoppage.
                  </span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.contactConsent}
                    onChange={(e) =>
                      setFormData({ ...formData, contactConsent: e.target.checked })
                    }
                    className="mt-0.5 rounded border-stone-300 text-stone-900 focus:ring-stone-500"
                  />
                  <span className="text-xs text-stone-700">
                    I consent to AnyRoomz and Decizy reviewing this intake and generating a structured decision roadmap. <span className="text-rose-600">*</span>
                  </span>
                </label>
                {errors.contactConsent && (
                  <p className="text-rose-600 text-[11px]">{errors.contactConsent}</p>
                )}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-4 border-t border-stone-100 flex items-center justify-between">
              <span className="text-xs text-stone-500">Tier A0 · Free Initial Screening</span>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-stone-900 rounded-lg hover:bg-stone-800 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span>Generating Roadmap...</span>
                ) : (
                  <>
                    <span>Generate Decision Check</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Right Rail: Architecture & Intake Guidance */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-stone-100/70 border border-stone-200 rounded-xl p-5 text-xs text-stone-700">
              <h3 className="font-bold text-stone-900 mb-2 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-stone-700" />
                <span>The A0 Screening Protocol</span>
              </h3>
              <p className="text-stone-600 leading-relaxed mb-3">
                Decizy cross-checks your project parameters against our 33 Master Architectural Decision types to map:
              </p>
              <ul className="space-y-2 text-stone-600">
                <li className="flex items-start gap-2">
                  <span className="text-stone-400">1.</span>
                  <span>Prerequisite decisions that must be locked before spending money.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone-400">2.</span>
                  <span>Severe-impact structural, waterproofing, and MEP pitfalls.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-stone-400">3.</span>
                  <span>Lead-time delays for imported stones, veneers, and custom joinery.</span>
                </li>
              </ul>
            </div>

            {/* Recent Submissions */}
            <div className="bg-white border border-stone-200 rounded-xl p-5 text-xs">
              <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-stone-700" />
                <span>Recent Intake Queue ({assessments.length})</span>
              </h3>
              <div className="space-y-3 divide-y divide-stone-100">
                {assessments.slice(0, 3).map((item) => (
                  <div key={item.id} className="pt-2 first:pt-0">
                    <div className="flex items-center justify-between font-mono text-[11px] tabular-nums">
                      <span className="font-bold text-stone-800">{item.referenceNumber}</span>
                      <span className="text-stone-500">{item.status}</span>
                    </div>
                    <div className="text-stone-600 mt-0.5">
                      {item.projectCity} · {item.projectType} · {item.approximateAreaSqFt} sq.ft
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
