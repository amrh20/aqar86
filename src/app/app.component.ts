import { NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { KpiCardsComponent } from './components/kpi-cards.component';
import { CashflowTabComponent } from './components/cashflow-tab.component';
import { ClientsTabComponent } from './components/clients-tab.component';
import { WithdrawalsTabComponent } from './components/withdrawals-tab.component';
import { MyVaultTabComponent } from './components/my-vault-tab.component';
import { OverdueTabComponent } from './components/overdue-tab.component';
import { GaragesTabComponent } from './components/garages-tab.component';
import { ToastHostComponent } from './components/toast-host.component';
import { AuthService } from './services/auth.service';
import { DashboardStore } from './services/dashboard-store.service';
import { ExcelParserService } from './services/excel-parser.service';
import { VaultStateService } from './services/vault-state.service';
import { WorkspaceApiService } from './services/workspace-api.service';
import { formatDate, formatMoney, toDateInputValue } from './utils/format';

type Tab = 'cashflow' | 'clients' | 'myvault' | 'overdue' | 'garages' | 'withdrawals';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NgClass,
    FormsModule,
    KpiCardsComponent,
    CashflowTabComponent,
    ClientsTabComponent,
    MyVaultTabComponent,
    OverdueTabComponent,
    GaragesTabComponent,
    WithdrawalsTabComponent,
    ToastHostComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly store = inject(DashboardStore);
  readonly parser = inject(ExcelParserService);
  readonly vault = inject(VaultStateService);
  readonly auth = inject(AuthService);
  readonly workspace = inject(WorkspaceApiService);
  readonly tab = signal<Tab>('cashflow');
  readonly dragging = signal(false);
  readonly email = signal('');
  readonly password = signal('');
  readonly importing = signal(false);
  readonly formatDate = formatDate;
  readonly formatMoney = formatMoney;

  readonly blockingMessage = computed(() => {
    if (this.auth.authLoading()) return 'جاري التحقق من الجلسة…';
    if (this.auth.loggingIn()) return 'جاري تسجيل الدخول…';
    if (this.workspace.loading()) return 'جاري تحميل البيانات من السيرفر…';
    if (this.store.parsing()) return 'جارٍ قراءة ملف الإكسيل…';
    if (this.importing()) return 'جاري استيراد النسخة الاحتياطية…';
    return null;
  });

  readonly saving = computed(() => this.workspace.syncStatus() === 'saving');

  loginButtonLabel(): string {
    return this.auth.loggingIn() ? 'جاري الدخول…' : 'تسجيل الدخول';
  }

  async submitLogin(): Promise<void> {
    this.workspace.loading.set(true);
    const ok = await this.auth.login(this.email(), this.password());
    if (!ok) {
      this.workspace.loading.set(false);
      return;
    }
    this.password.set('');
    try {
      await this.workspace.load();
    } catch {
      this.workspace.loading.set(false);
      this.workspace.syncStatus.set('error');
    }
  }

  logout(): void {
    this.auth.logout();
    this.store.clear();
    this.vault.replaceVaultState({}, []);
    this.workspace.syncStatus.set('synced');
  }

  async onFile(file: File | undefined): Promise<void> {
    if (!file || this.auth.isViewer()) return;
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
    const data = this.store.data();
    const contracts = data?.contracts ?? [];
    const payload = {
      updatedAt: new Date().toISOString(),
      lastFileName: data?.fileName ?? '',
      contracts,
      installments: contracts.flatMap((contract) => contract.installments ?? []),
      excelWithdrawals: data?.withdrawals ?? [],
      manualPaidMap: this.vault.manualPaidMap(),
      payoutHistory: this.vault.payoutHistory(),
    };
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
    if (!file || this.auth.isViewer()) return;
    this.importing.set(true);
    this.vault.importError.set(null);
    try {
      this.vault.importJson(await file.text());
    } catch {
      this.vault.importError.set('تعذر استيراد النسخة الاحتياطية. تأكد أن الملف JSON صالح.');
    } finally {
      this.importing.set(false);
    }
  }
}
