import React, { useState, useEffect } from 'react';
import { getSelldoneAdapter, selldoneConfig } from '../../lib/selldone/adapter';
import { SelldoneServiceProduct, SelldoneOrder } from '../../lib/selldone/types';
import { ServiceTierConfig } from '../../types';
import {
  ShoppingBag,
  ShieldCheck,
  Check,
  ArrowUpRight,
  ExternalLink,
  RefreshCw,
  Terminal,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export const ServicesAndCommerceView: React.FC = () => {
  const [products, setProducts] = useState<SelldoneServiceProduct[]>([]);
  const [selectedOrderQuery, setSelectedOrderQuery] = useState('SLD-2906-8812');
  const [retrievedOrder, setRetrievedOrder] = useState<SelldoneOrder | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const adapter = getSelldoneAdapter();

  useEffect(() => {
    adapter.getProducts().then((res) => setProducts(res));
  }, []);

  const handleLookupOrder = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const order = await adapter.getOrder(selectedOrderQuery);
      setRetrievedOrder(order);
      if (order) {
        setTestResult(
          `[Selldone Adapter] Order ${order.orderNumber} successfully retrieved. Status: ${order.status}. Verified shopId: 2906.`
        );
      } else {
        setTestResult(`[Selldone Adapter] Order "${selectedOrderQuery}" not found in Shop 2906 registry.`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestProvisioning = async () => {
    if (!retrievedOrder) return;
    setLoading(true);
    try {
      const result = await adapter.provisionEntitlementForOrder(retrievedOrder);
      setTestResult(
        `[Provisioning Result] ${result.message} (Entitlement ID: ${result.entitlementId})`
      );
    } finally {
      setLoading(false);
    }
  };

  const serviceTiers: ServiceTierConfig[] = [
    {
      id: 'A0',
      name: 'A0 — Free Decision Check',
      badge: 'Screening',
      subtitle: 'For homeowners & architects exploring project feasibility',
      basePriceINR: 0,
      isFree: true,
      billingType: 'one-time',
      features: [
        'Initial intake assessment questionnaire',
        'Preliminary zoning & civil risk flags',
        'Roadmap of 3 immediate prerequisite decisions',
        'Unique Decizy intake reference number',
        'No credit card or payment required',
      ],
    },
    {
      id: 'A1',
      name: 'A1 — Paid Decision Support',
      badge: 'Single Bottleneck',
      subtitle: 'For resolving a critical structural, MEP, or material bottleneck',
      basePriceINR: 4999,
      isFree: false,
      billingType: 'one-time',
      features: [
        'Deep technical review on 1 master decision type',
        'Downstream trade-off analysis & costing',
        'Material testing guidelines (e.g. Dekton vs Quartz)',
        'Written engineering review endorsement',
        'Delivered within 48 business hours',
      ],
      selldoneProductId: 'prd-a1-support',
    },
    {
      id: 'B1',
      name: 'B1 — Project Decision Management',
      badge: 'Full Engagement',
      subtitle: 'For complete interior or architecture projects through handover',
      basePriceINR: 45000,
      isFree: false,
      billingType: 'project',
      features: [
        'Full access to all 33 Master Decision Types',
        'Interactive dependency graph & critical path tracking',
        'Automated change-impact downriver review flags',
        'Immutable revision history & audit logs',
        'Multi-role workspace (Customer, Designer, PM, Admin)',
        'Project documents & drawing archives',
      ],
      selldoneProductId: 'prd-b1-decision-mgmt',
    },
    {
      id: 'C1',
      name: 'C1 — Ongoing Decision Advisory',
      badge: 'Retainer',
      subtitle: 'Continuous support for bespoke luxury villas and high-spec builds',
      basePriceINR: 15000,
      isFree: false,
      billingType: 'monthly',
      features: [
        'Monthly active decision management & site checks',
        'Continuous material lot inspection oversight',
        'Contractor dispute & change order reconciliation',
        'Pre-handover snag list audit & holdback retention sign-off',
        'Priority SLA with lead architecture consultants',
      ],
      selldoneProductId: 'prd-c1-ongoing-support',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-mono text-stone-500 uppercase tracking-wider mb-1">
          <span>Module K & M</span>
          <span aria-hidden="true">·</span>
          <span>Commercial Model & Commerce Gateway</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-900">
          Service Tiers & Selldone Genesis Integration
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Decizy connects with AnyRoomz Selldone Commerce (Shop ID 2906) to govern verified membership entitlements and order-backed project unlocks.
        </p>
      </div>

      {/* Selldone Commerce Architecture Notice */}
      <div className="bg-stone-900 text-stone-100 rounded-xl p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-amber-400 uppercase">
              <ShoppingBag className="w-4 h-4" />
              <span>Selldone Genesis Adapter · Shop ID 2906</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              Integration Boundary & Separation of Concerns
            </h2>
            <p className="text-xs text-stone-300 max-w-3xl leading-relaxed">
              <span className="font-semibold text-white">Selldone (anyroomz.com)</span> manages the storefront catalog, Razorpay/Stripe checkout, taxes, and customer orders.
              <span className="font-semibold text-white"> Decizy</span> manages architectural project state, decision dependency graphs, approvals, and immutable audit logs.
              Verified orders dynamically provision tier entitlements.
            </p>
          </div>

          <a
            href="https://anyroomz.com"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 text-xs font-semibold bg-white text-stone-900 hover:bg-stone-100 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>Visit AnyRoomz Store</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Service Tiers Grid (SaaS Tier Cards per Frontend Guidelines) */}
      <div>
        <h2 className="text-lg font-bold text-stone-900 mb-4">
          Configurable Service Tiers & Entitlements
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {serviceTiers.map((tier) => (
            <div
              key={tier.id}
              className={`bg-white border rounded-xl p-5 shadow-xs flex flex-col justify-between ${
                tier.id === 'B1' ? 'border-stone-900 ring-1 ring-stone-900' : 'border-stone-200'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-stone-500 uppercase">
                    {tier.badge}
                  </span>
                  {tier.id === 'B1' && (
                    <span className="text-[10px] uppercase font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                      Most Selected
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-stone-900 mt-2">{tier.name}</h3>
                <p className="text-xs text-stone-500 mt-1 min-h-[32px]">{tier.subtitle}</p>

                <div className="mt-4 pt-4 border-t border-stone-100">
                  <div className="text-2xl font-bold font-mono tabular-nums text-stone-900">
                    {tier.isFree ? (
                      'Free'
                    ) : (
                      <>
                        ₹{tier.basePriceINR.toLocaleString('en-IN')}
                        <span className="text-xs text-stone-500 font-normal ml-1">
                          / {tier.billingType}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <ul className="mt-4 space-y-2 text-xs text-stone-600">
                  {tier.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-stone-800 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 pt-4 border-t border-stone-100">
                <button
                  onClick={() =>
                    alert(
                      tier.isFree
                        ? 'Navigating to A0 Decision Check intake form.'
                        : `Order verification routed through Selldone Shop 2906 for SKU: ${tier.selldoneProductId}`
                    )
                  }
                  className={`w-full py-2 text-xs font-semibold rounded-lg transition-colors ${
                    tier.id === 'B1'
                      ? 'bg-stone-900 text-white hover:bg-stone-800'
                      : 'bg-stone-100 text-stone-900 hover:bg-stone-200'
                  }`}
                >
                  {tier.isFree ? 'Start Free Check' : 'Order via AnyRoomz'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selldone Adapter Testing & Diagnostics Console */}
      <div className="bg-white border border-stone-200 rounded-xl p-6 sm:p-8 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-stone-700" />
              <span>Selldone Integration Adapter Console (Shop 2906)</span>
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              Verify order retrieval, typed payload validation, and entitlement provisioning with safe demonstration fallbacks.
            </p>
          </div>
          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
            Adapter: Ready
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 text-xs">
          {/* Order lookup input */}
          <div className="md:col-span-6 space-y-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                Lookup Selldone Order Number / ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={selectedOrderQuery}
                  onChange={(e) => setSelectedOrderQuery(e.target.value)}
                  placeholder="e.g. SLD-2906-8812"
                  className="flex-1 text-xs px-3 py-2 border border-stone-300 rounded-lg font-mono"
                />
                <button
                  onClick={handleLookupOrder}
                  disabled={loading}
                  className="px-4 py-2 bg-stone-900 text-white font-medium rounded-lg hover:bg-stone-800 transition-colors whitespace-nowrap"
                >
                  {loading ? 'Querying...' : 'Lookup Order'}
                </button>
              </div>
              <p className="text-[11px] text-stone-500 mt-1">
                Try seed order: <span className="font-mono text-stone-800">SLD-2906-8812</span>
              </p>
            </div>

            {retrievedOrder && (
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-stone-900">{retrievedOrder.orderNumber}</span>
                  <span className="font-semibold text-emerald-700">{retrievedOrder.status}</span>
                </div>
                <div className="text-stone-700">
                  <div>Customer: {retrievedOrder.customer.name} ({retrievedOrder.customer.email})</div>
                  <div>Total: ₹{retrievedOrder.totalAmountINR.toLocaleString('en-IN')} via {retrievedOrder.paymentGateway}</div>
                  <div>Linked Project: {retrievedOrder.projectCode || 'Not Assigned'}</div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    onClick={handleTestProvisioning}
                    disabled={loading}
                    className="px-3 py-1.5 bg-stone-900 text-white font-medium rounded-lg hover:bg-stone-800 transition-colors"
                  >
                    Test Provision Entitlement
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Diagnostic Log Output */}
          <div className="md:col-span-6 bg-stone-950 text-stone-200 p-4 rounded-xl font-mono text-[11px] overflow-x-auto min-h-[160px] flex flex-col justify-between">
            <div className="space-y-1">
              <div className="text-stone-500">// Selldone Genesis Event Dispatcher Log</div>
              <div>Adapter: MockSelldoneAdapter (Shop 2906)</div>
              <div>Endpoint: https://api.selldone.com/v1/shops/2906/orders</div>
              <div>Redaction: API keys and bearer tokens masked in memory.</div>
              {testResult && (
                <div className="mt-2 text-amber-300 font-medium whitespace-pre-wrap">
                  {testResult}
                </div>
              )}
            </div>
            <div className="text-stone-600 text-[10px] pt-2 border-t border-stone-800">
              Safe demonstration mode: No production writes dispatched.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
