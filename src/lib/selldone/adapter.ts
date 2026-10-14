import { ISelldoneAdapter, SelldoneConfig } from './types';
import { MockSelldoneAdapter } from './mockAdapter';

/**
 * Selldone Adapter Factory & Manager
 * Target: Shop ID 2906 (https://anyroomz.com)
 */

const getEnvVar = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) {
    return (import.meta as any).env[key];
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key];
  }
  return undefined;
};

const SELLDONE_SHOP_ID = getEnvVar('VITE_SELLDONE_SHOP_ID') || '2906';
const SELLDONE_API_KEY = getEnvVar('VITE_SELLDONE_API_KEY');

export const selldoneConfig: SelldoneConfig = {
  shopId: SELLDONE_SHOP_ID,
  apiHost: 'https://api.selldone.com',
  isMock: !SELLDONE_API_KEY || SELLDONE_API_KEY.includes('placeholder'),
};

let activeAdapter: ISelldoneAdapter | null = null;

export const getSelldoneAdapter = (): ISelldoneAdapter => {
  if (!activeAdapter) {
    if (selldoneConfig.isMock) {
      console.info(
        `[Selldone] Initialized MockSelldoneAdapter for Shop ID ${selldoneConfig.shopId}. Real API key not detected.`
      );
      activeAdapter = new MockSelldoneAdapter();
    } else {
      // In live production, this would initialize the confidential server adapter.
      // For safe demonstration & local security, fall back to mock until backend proxy is configured.
      console.info(
        `[Selldone] Initialized Safe MockSelldoneAdapter (Shop ID ${selldoneConfig.shopId}).`
      );
      activeAdapter = new MockSelldoneAdapter();
    }
  }
  return activeAdapter;
};
