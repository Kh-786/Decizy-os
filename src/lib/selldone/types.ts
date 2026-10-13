/**
 * Selldone Genesis Commerce Integration Types
 * For AnyRoomz / Decizy (Shop ID: 2906)
 */

export interface SelldoneConfig {
  shopId: string; // 2906
  apiHost: string; // e.g. 'https://api.selldone.com'
  clientId?: string;
  isMock: boolean;
}

export type SelldoneServiceCode = 'A0' | 'A1' | 'B1' | 'C1';

export interface SelldoneServiceProduct {
  id: string;
  sku: string;
  title: string;
  serviceCode: SelldoneServiceCode;
  priceINR: number;
  currency: 'INR';
  description: string;
  isEntitlementActive: boolean;
  selldoneUrl: string;
}

export interface SelldoneOrder {
  id: string;
  shopId: string;
  orderNumber: string;
  customer: {
    id: string;
    email: string;
    name: string;
    phone?: string;
  };
  items: {
    productId: string;
    sku: string;
    title: string;
    serviceCode: SelldoneServiceCode;
    unitPriceINR: number;
    quantity: number;
  }[];
  totalAmountINR: number;
  status: 'PENDING' | 'PAID' | 'CANCELED' | 'REFUNDED';
  paymentGateway: 'Razorpay' | 'Stripe' | 'Bank Transfer' | 'Demo';
  transactionReference: string;
  createdAt: string;
  entitlementProvisioned: boolean;
  projectCode?: string;
}

export interface SelldoneWebhookPayload {
  event: 'order.payment.success' | 'order.payment.failed' | 'order.refunded';
  shop_id: string;
  order_id: string;
  timestamp: string;
  signature: string;
  data: {
    order_number: string;
    customer_email: string;
    amount: number;
    currency: string;
    service_sku: string;
  };
}

export interface ISelldoneAdapter {
  isReady(): boolean;
  getProducts(): Promise<SelldoneServiceProduct[]>;
  getOrder(orderId: string): Promise<SelldoneOrder | null>;
  verifyWebhook(payload: SelldoneWebhookPayload): Promise<boolean>;
  provisionEntitlementForOrder(order: SelldoneOrder): Promise<{
    success: boolean;
    tier: SelldoneServiceCode;
    entitlementId: string;
    message: string;
  }>;
}
