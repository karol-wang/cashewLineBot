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

type TransactionDirection = 'expense' | 'income';

type CategoryMap = Record<string, string[]>;

interface CategoryCatalog {
  expense: CategoryMap;
  income: CategoryMap;
}

export type { Transaction, CashewPlatform, TransactionDirection, CategoryMap, CategoryCatalog };
