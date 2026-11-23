import { Component, inject, signal } from '@angular/core';
import { KpiCardsComponent } from './components/kpi-cards.component';
import { CashflowTabComponent } from './components/cashflow-tab.component';
import { ClientsTabComponent } from './components/clients-tab.component';
import { WithdrawalsTabComponent } from './components/withdrawals-tab.component';
import { MyVaultTabComponent } from './components/my-vault-tab.component';
import { DashboardStore } from './services/dashboard-store.service';
import { ExcelParserService } from './services/excel-parser.service';
import { LatestStateService } from './services/latest-state.service';
import { VaultStateService } from './services/vault-state.service';
import { formatDate, formatMoney, toDateInputValue } from './utils/format';

type Tab = 'cashflow' | 'clients' | 'myvault' | 'withdrawals';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [KpiCardsComponent, CashflowTabComponent, ClientsTabComponent, MyVaultTabComponent, WithdrawalsTabComponent],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly store = inject(DashboardStore);
  readonly parser = inject(ExcelParserService);
  readonly vault = inject(VaultStateService);
  private readonly latestState = inject(LatestStateService);
  readonly tab = signal<Tab>('cashflow');
  readonly dragging = signal(false);
  readonly formatDate = formatDate;
  readonly formatMoney = formatMoney;

  async onFile(file: File | undefined): Promise<void> {
    if (!file) return;
    this.store.parsing.set(true);
    this.store.error.set(null);
    try {
      const parsed = await this.parser.parseFile(file);
      this.store.setData(parsed);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر قراءة الملف';
      this.store.error.set(message);
    } finally {
      this.store.parsing.set(false);
    }
  }

  onInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    void this.onFile(input.files?.[0]);
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    void this.onFile(event.dataTransfer?.files?.[0]);
  }

  exportBackup(): void {
    const blob = new Blob([this.vault.exportJson()], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `piece86-vault-${toDateInputValue()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  exportLatestSiteState(): void {
    const payload = this.latestState.exportSiteState();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'latest-state.json';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async onImport(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      this.vault.importJson(await file.text());
    } catch {
      this.vault.importError.set('تعذر استيراد النسخة الاحتياطية. تأكد أن الملف JSON صالح.');
    }
  }
}
