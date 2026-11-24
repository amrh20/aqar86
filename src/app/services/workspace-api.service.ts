import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { Contract, Installment, PayoutRecord, ParsedWorkbook, Withdrawal } from '../models/dashboard.models';
import { AuthService } from './auth.service';
import { DashboardStore } from './dashboard-store.service';
import { VaultStateService } from './vault-state.service';

export interface WorkspaceDto {
  id: string;
  lastFileName: string;
  contracts: Contract[];
  installments: Installment[];
  excelWithdrawals: Withdrawal[];
  manualPaidMap: Record<string, boolean>;
  payoutHistory: PayoutRecord[];
  updatedAt: string;
  updatedBy: string | null;
}

@Injectable({ providedIn: 'root' })
export class WorkspaceApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly store = inject(DashboardStore);
  private readonly vault = inject(VaultStateService);

  readonly syncStatus = signal<'synced' | 'saving' | 'error'>('synced');
  readonly loading = signal(false);
  readonly updatedAt = signal<string | null>(null);
  private applying = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const save = () => this.scheduleSave();
    this.store.bindSync(save);
    this.vault.bindSync(save);
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const state = await firstValueFrom(this.http.get<WorkspaceDto>(`${environment.apiUrl}/workspace`));
      this.apply(state);
    } finally {
      this.loading.set(false);
    }
  }

  scheduleSave(): void {
    if (this.applying || !this.auth.isAdmin()) return;
    this.syncStatus.set('saving');
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 300);
  }

  private async flush(): Promise<void> {
    this.timer = null;
    if (!this.auth.isAdmin()) return;
    this.syncStatus.set('saving');
    const data = this.store.data();
    const contracts = data?.contracts ?? [];
    const body = {
      lastFileName: data?.fileName ?? '',
      contracts,
      installments: contracts.flatMap((contract) => contract.installments ?? []),
      excelWithdrawals: data?.withdrawals ?? [],
      manualPaidMap: this.vault.manualPaidMap(),
      payoutHistory: this.vault.payoutHistory(),
    };
    try {
      const saved = await firstValueFrom(this.http.put<WorkspaceDto>(`${environment.apiUrl}/workspace`, body));
      this.updatedAt.set(saved.updatedAt);
      this.syncStatus.set('synced');
    } catch {
      this.syncStatus.set('error');
    }
  }

  private apply(state: WorkspaceDto): void {
    this.applying = true;
    const contracts = Array.isArray(state.contracts) ? state.contracts : [];
    const withdrawals = Array.isArray(state.excelWithdrawals) ? state.excelWithdrawals : [];
    if (contracts.length || withdrawals.length || state.lastFileName) {
      const workbook: ParsedWorkbook = {
        fileName: state.lastFileName || 'piece86',
        uploadedAt: state.updatedAt,
        contracts,
        withdrawals,
        totalWithdrawn: round2(withdrawals.reduce((sum, item) => sum + (item.amount || 0), 0)),
      };
      this.store.setData(workbook, state.updatedAt);
    } else {
      this.store.clear();
    }
    this.vault.replaceVaultState(state.manualPaidMap ?? {}, state.payoutHistory ?? [], state.updatedAt);
    this.updatedAt.set(state.updatedAt);
    this.syncStatus.set('synced');
    this.applying = false;
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
