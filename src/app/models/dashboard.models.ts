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
  scheduleLabel?: string;
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
  /** True when this record is a garage-only deal (no apartment sale). */
  garageOnly?: boolean;
}

export type GarageMode = 'scheduled' | 'blended' | 'partial';

/** Aggregated garage view for the dedicated Garages tab. */
export interface GarageAccount {
  id: string;
  clientName: string;
  clientCode: string;
  unitNumber: string;
  garageOnly: boolean;
  garagePrice: number;
  paidAmount: number;
  remainingAmount: number;
  partnerRemainingShare: number;
  remainingMonths: number;
  nextDueDate: string | null;
  mode: GarageMode;
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

/** Bundled / deployable full app snapshot (public/latest-state.json). */
export interface LatestSiteState {
  updatedAt: string;
  lastFileName: string;
  contracts: Contract[];
  installments: Installment[];
  excelWithdrawals: Withdrawal[];
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
  scheduleLabel: string;
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
