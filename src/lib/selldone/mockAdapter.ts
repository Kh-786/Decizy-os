import {
  ISelldoneAdapter,
  SelldoneOrder,
  SelldoneServiceProduct,
  SelldoneWebhookPayload,
} from './types';

/**
 * Mock Selldone Adapter
 * Safe local development simulation for AnyRoomz Shop ID: 2906
 * Explicitly marked as mock so users never mistake it for production writes.
 */
export class MockSelldoneAdapter implements ISelldoneAdapter {
  private readonly shopId = '2906';
  private mockOrders: Map<string, SelldoneOrder> = new Map();

  constructor() {
    this.seedMockOrders();
  }

  private seedMockOrders() {
    const sampleOrder: SelldoneOrder = {
      id: 'selldone-ord-2906-8812',
      shopId: this.shopId,
      orderNumber: 'SLD-2906-8812',
      customer: {
        id: 'cust-blr-01',
        email: 'rahul.sharma@example.com',
        name: 'Rahul Sharma',
        phone: '+91 98450 12345',
      },
      items: [
        {
          productId: 'prd-b1-decision-mgmt',
          sku: 'DECIZY-TIER-B1',
          title: 'B1 — Project Decision Management Package',
          serviceCode: 'B1',
          unitPriceINR: 45000,
          quantity: 1,
        },
      ],
      totalAmountINR: 45000,
      status: 'PAID',
      paymentGateway: 'Razorpay',
      transactionReference: 'pay_OMgK9x21JsdL',
      createdAt: '2026-09-15T10:30:00Z',
      entitlementProvisioned: true,
      projectCode: 'PRJ-BLR-001',
    };

    this.mockOrders.set(sampleOrder.id, sampleOrder);
    this.mockOrders.set(sampleOrder.orderNumber, sampleOrder);
  }

  isReady(): boolean {
    return true; // Mock adapter is always ready for dev
  }

  async getProducts(): Promise<SelldoneServiceProduct[]> {
    return [
      {
        id: 'prd-a0-check',
        sku: 'DECIZY-TIER-A0',
        title: 'A0 — Free Decision Screening Check',
        serviceCode: 'A0',
        priceINR: 0,
        currency: 'INR',
        description: 'Comprehensive initial intake screening, zoning risks and decision roadmap generation.',
        isEntitlementActive: true,
        selldoneUrl: 'https://anyroomz.com/services/a0-decision-check',
      },
      {
        id: 'prd-a1-support',
        sku: 'DECIZY-TIER-A1',
        title: 'A1 — Paid Single-Decision Review & Advisory',
        serviceCode: 'A1',
        priceINR: 4999,
        currency: 'INR',
        description: 'Deep-dive review on a critical structural, MEP or aesthetic bottleneck with material impact analysis.',
        isEntitlementActive: false,
        selldoneUrl: 'https://anyroomz.com/services/a1-decision-support',
      },
      {
        id: 'prd-b1-decision-mgmt',
        sku: 'DECIZY-TIER-B1',
        title: 'B1 — Full Project Decision Intelligence Management',
        serviceCode: 'B1',
        priceINR: 45000,
        currency: 'INR',
        description: '33 Master decision types register, dependency graph, change-impact tracker, RLS audit log and approval signoffs.',
        isEntitlementActive: true,
        selldoneUrl: 'https://anyroomz.com/services/b1-decision-management',
      },
      {
        id: 'prd-c1-ongoing-support',
        sku: 'DECIZY-TIER-C1',
        title: 'C1 — Ongoing Architecture & Interior Decision Support',
        serviceCode: 'C1',
        priceINR: 15000,
        currency: 'INR',
        description: 'Monthly continuous decision advisory, site revision checks, material dry-lay audits and snagging holdbacks.',
        isEntitlementActive: false,
        selldoneUrl: 'https://anyroomz.com/services/c1-ongoing-support',
      },
    ];
  }

  async getOrder(orderIdOrNumber: string): Promise<SelldoneOrder | null> {
    const order = this.mockOrders.get(orderIdOrNumber);
    return order || null;
  }

  async verifyWebhook(payload: SelldoneWebhookPayload): Promise<boolean> {
    // In mock mode, check if shop ID matches 2906
    if (payload.shop_id !== this.shopId) {
      console.warn(`[MockSelldone] Rejected webhook with invalid shop ID: ${payload.shop_id}`);
      return false;
    }
    return true;
  }

  async provisionEntitlementForOrder(order: SelldoneOrder): Promise<{
    success: boolean;
    tier: 'A0' | 'A1' | 'B1' | 'C1';
    entitlementId: string;
    message: string;
  }> {
    if (order.status !== 'PAID') {
      return {
        success: false,
        tier: 'A0',
        entitlementId: '',
        message: `Order ${order.orderNumber} is in status ${order.status}. Entitlement requires PAID status.`,
      };
    }

    const tier = order.items[0]?.serviceCode || 'B1';
    order.entitlementProvisioned = true;

    return {
      success: true,
      tier,
      entitlementId: `ent-${order.id}-${Date.now().toString(36)}`,
      message: `Successfully provisioned ${tier} entitlement for ${order.customer.email}`,
    };
  }
}
