export type InstallmentStatus = 'paid' | 'overdue' | 'upcoming';

export type ItemKind = 'downPayment' | 'installment';

export type ItemLifecycle = 'unpaid' | 'vault' | 'settled';

export type LifecycleFilter = 'all' | ItemLifecycle;

export interface Installment {
  id: string;
  dueDate: string | null;
  amount: number;
  paidDate: string | null;
  paidAmount: number;
  remainingAmount: number;
  status: InstallmentStatus;
  partnerPaidShare: number;
  partnerRemainingShare: number;
}

export interface Contract {
  clientCode: string;
  clientName: string;
  unitNumber: string;
  floor: string;
  area: number | null;
  unitPrice: number;
  garagePrice: number;
  totalContract: number;
  downPayment: number;
  contractDate: string | null;
  commission5Pct: number;
  netDownPayment: number;
  partnerDownPaymentShare: number;
  downPaymentId: string;
  installments: Installment[];
}

export interface PayoutRecord {
  id: string;
  date: string;
  amount: number;
  note: string;
  settledItemIds: string[];
  itemsCount: number;
}

export interface VaultBackup {
  manualPaidMap: Record<string, boolean>;
  payoutHistory: PayoutRecord[];
}

export interface TrackedItem {
  id: string;
  kind: ItemKind;
  clientName: string;
  clientCode: string;
  unitNumber: string;
  dueDate: string | null;
  amount: number;
  partnerShare: number;
  excelPaid: boolean;
  label: string;
}

export interface Withdrawal {
  date: string | null;
  amount: number;
  description: string;
}

export interface ParsedWorkbook {
  fileName: string;
  uploadedAt: string;
  contracts: Contract[];
  withdrawals: Withdrawal[];
  totalWithdrawn: number;
}

export interface MonthBucket {
  key: string;
  label: string;
  tone: 'overdue' | 'current' | 'upcoming' | 'unknown' | 'complete';
  count: number;
  totalAmount: number;
  partnerShare: number;
  dueCount: number;
  dueAmount: number;
  dueShare: number;
  rows: MonthInstallmentRow[];
}

export interface MonthInstallmentRow {
  id: string;
  kind: ItemKind;
  clientName: string;
  unitNumber: string;
  dueDate: string | null;
  amount: number;
  remainingAmount: number;
  partnerShare: number;
  status: InstallmentStatus;
}

export interface DashboardTotals {
  totalEarnedToDate: number;
  totalFutureShare: number;
  totalWithdrawn: number;
  netBalance: number;
  currentMonthShare: number;
  currentMonthCount: number;
  soldUnits: number;
}
