export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id?: string;
  userId: string;
  amount: number;
  type: TransactionType;
  categoryId?: string;
  categoryName: string;
  note?: string;
  date: any; // Firestore Timestamp
}

export interface Category {
  id?: string;
  userId?: string;
  name: string;
  type: TransactionType;
  isDefault: boolean;
}

export interface AIParseResult {
  amount: number;
  type: TransactionType;
  categoryName: string;
  note?: string;
}
