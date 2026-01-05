export interface Transaction {
  global_id: string;
  timestamp: string;
  merchant: string;
  amount: number;
  currency: string;
  institution: string;
  payment_instrument: string;
  notes: string;
  category: string | null;
}

export interface SyncResult {
  processed: number;
  errors: number;
  skipped: number;
}

export interface BackfillRequest {
  start_date: string;
  end_date: string;
}

export interface TransactionSummary {
  total_transactions: number;
  by_institution: Record<string, number>;
  by_currency: Record<string, number>;
  by_category: Record<string, number>;
  total_amount_by_currency: Record<string, number>;
  total_amount_by_category: Record<string, number>;
}
