/**
 * Cashew App Link 建立需要用到的交易紀錄
 */
interface Transaction {
  title?: string;
  category: string;
  subcategory?: string;
  amount: number;
  note?: string;
  /** YYYY-MM-DD string */
  date?: string;
  account?: '我的錢錢' | '侯阿君';
}

interface CashewPlatform {
  webApp: string;
  app: string;
}

export type { Transaction, CashewPlatform };
