import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { Contract, LatestSiteState, ParsedWorkbook } from '../models/dashboard.models';
import { DashboardStore } from './dashboard-store.service';
import { readLocalUpdatedAt, writeLocalUpdatedAt } from './state-meta';
import { VaultStateService } from './vault-state.service';

@Injectable({ providedIn: 'root' })
export class LatestStateService {
  private readonly http = inject(HttpClient);
  private readonly store = inject(DashboardStore);
  private readonly vault = inject(VaultStateService);

  async init(): Promise<void> {
    try {
      const bundled = await firstValueFrom(
        this.http.get<LatestSiteState>(`/latest-state.json?t=${Date.now()}`),
      );
      if (!bundled?.updatedAt) return;

      const hasLocalDashboard = !!localStorage.getItem('piece86.dashboard.v1');
      const hasLocalVault = !!localStorage.getItem('piece86.vault.v1');
      const hasAnyLocal = hasLocalDashboard || hasLocalVault;

      if (!hasAnyLocal) {
        this.applyBundled(bundled);
        return;
      }

      const localAt = readLocalUpdatedAt();
      if (!localAt) {
        return;
      }
      if (new Date(bundled.updatedAt).getTime() > new Date(localAt).getTime()) {
        this.applyBundled(bundled);
      }
    } catch {
      // Bundled file missing or unreadable — keep local data.
    }
  }

  exportSiteState(): LatestSiteState {
    const data = this.store.data();
    const contracts = data?.contracts ?? [];
    return {
      updatedAt: new Date().toISOString(),
      lastFileName: data?.fileName ?? '',
      contracts,
      installments: flattenInstallments(contracts),
      excelWithdrawals: data?.withdrawals ?? [],
      manualPaidMap: { ...this.vault.manualPaidMap() },
      payoutHistory: [...this.vault.payoutHistory()],
    };
  }

  private applyBundled(state: LatestSiteState): void {
    const contracts = state.contracts ?? [];
    if (!contracts.length && !state.payoutHistory?.length && !Object.keys(state.manualPaidMap ?? {}).length) {
      return;
    }

    const withdrawals = state.excelWithdrawals ?? [];
    const workbook: ParsedWorkbook = {
      fileName: state.lastFileName || 'latest-state.json',
      uploadedAt: state.updatedAt,
      contracts,
      withdrawals,
      totalWithdrawn: round2(withdrawals.reduce((sum, w) => sum + w.amount, 0)),
    };
    this.store.setData(workbook, state.updatedAt);
    this.vault.replaceVaultState(state.manualPaidMap ?? {}, state.payoutHistory ?? [], state.updatedAt);
    writeLocalUpdatedAt(state.updatedAt);
  }
}

function flattenInstallments(contracts: Contract[]) {
  return contracts.flatMap((c) => c.installments ?? []);
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}