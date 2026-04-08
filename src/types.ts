interface Transaction {
  title?: string;
  category: string;
  subcategory: string;
  amount: number;
  note?: string;
  date?: string;
  account?: '我的錢錢' | '侯阿君';
}

export type { Transaction };
