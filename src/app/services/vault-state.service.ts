import { Injectable, computed, inject, signal } from '@angular/core';
import { ItemLifecycle, PayoutRecord, TrackedItem, VaultBackup } from '../models/dashboard.models';
import { DashboardStore } from './dashboard-store.service';
import { downPaymentLabel } from '../utils/schedule-labels';
import { writeLocalUpdatedAt } from './state-meta';
import { ToastService } from './toast.service';

const STORAGE_KEY = 'piece86.vault.v1';

@Injectable({ providedIn: 'root' })
export class VaultStateService {
  private readonly store = inject(DashboardStore);
  private readonly toast = inject(ToastService);

  readonly manualPaidMap = signal<Record<string, boolean>>({});
  readonly payoutHistory = signal<PayoutRecord[]>([]);
  readonly modalOpen = signal(false);
  readonly undoOpen = signal(false);
  readonly previewOpen = signal(false);
  readonly payoutDate = signal('');
  readonly payoutNote = signal('');
  /** بنود مختارة داخل مودال الاستلام — الكل محدد افتراضيًا */
  readonly payoutSelectedIds = signal<Record<string, boolean>>({});
  readonly payoutSearch = signal('');
  readonly importError = signal<string | null>(null);
  /** بند في انتظار تأكيد تفعيل/إلغاء التسديد من التشيك بوكس */
  readonly pendingToggleId = signal<string | null>(null);

  readonly pendingToggle = computed(() => {
    const id = this.pendingToggleId();
    if (!id) return null;
    const item = this.itemById().get(id) ?? null;
    const willCheck = !this.isChecked(id);
    return { id, item, willCheck };
  });

  readonly catalog = computed<TrackedItem[]>(() => {
    const items: TrackedItem[] = [];
    for (const contract of this.store.contracts()) {
      items.push({
        id: contract.downPaymentId,
        kind: 'downPayment',
        clientName: contract.clientName,
        clientCode: contract.clientCode,
        unitNumber: contract.unitNumber,
        dueDate: contract.contractDate,
        amount: contract.downPayment,
        partnerShare: contract.partnerDownPaymentShare,
        excelPaid: true,
        label: downPaymentLabel(),
      });
      for (const installment of contract.installments) {
        items.push({
          id: installment.id,
          kind: 'installment',
          clientName: contract.clientName,
          clientCode: contract.clientCode,
          unitNumber: contract.unitNumber,
          dueDate: installment.dueDate,
          amount: installment.amount,
          partnerShare: round2(installment.amount * 0.07),
          excelPaid: installment.remainingAmount <= 0 && installment.paidAmount > 0,
          label: installment.scheduleLabel ?? 'قسط دوري',
        });
      }
    }
    return items;
  });

  readonly itemById = computed(() => {
    const map = new Map<string, TrackedItem>();
    for (const item of this.catalog()) map.set(item.id, item);
    return map;
  });

  readonly settledById = computed(() => {
    const map = new Map<string, PayoutRecord>();
    for (const payout of this.payoutHistory()) {
      for (const id of payout.settledItemIds) map.set(id, payout);
    }
    return map;
  });

  readonly inVaultItems = computed(() => this.catalog().filter((item) => this.lifecycle(item.id) === 'vault'));

  readonly vaultBalance = computed(() => round2(this.inVaultItems().reduce((sum, item) => sum + item.partnerShare, 0)));

  readonly vaultCount = computed(() => this.inVaultItems().length);

  readonly filteredPayoutItems = computed(() => {
    const q = this.payoutSearch().trim().toLowerCase();
    const items = this.inVaultItems();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.clientName.toLowerCase().includes(q) ||
        item.unitNumber.toLowerCase().includes(q) ||
        item.clientCode.toLowerCase().includes(q) ||
        item.label.toLowerCase().includes(q),
    );
  });

  readonly selectedPayoutItems = computed(() =>
    this.inVaultItems().filter((item) => this.payoutSelectedIds()[item.id] !== false),
  );

  readonly unselectedPayoutItems = computed(() =>
    this.inVaultItems().filter((item) => this.payoutSelectedIds()[item.id] === false),
  );

  readonly selectedPayoutBalance = computed(() =>
    round2(this.selectedPayoutItems().reduce((sum, item) => sum + item.partnerShare, 0)),
  );

  readonly unselectedPayoutBalance = computed(() =>
    round2(this.unselectedPayoutItems().reduce((sum, item) => sum + item.partnerShare, 0)),
  );

  readonly selectedPayoutCount = computed(() => this.selectedPayoutItems().length);

  /** مجموع كل عمليات «استلام وتصفير الخزنة» — المبلغ التراكمي اللي معاك */
  readonly personalVaultTotal = computed(() =>
    round2(this.payoutHistory().reduce((sum, p) => sum + p.amount, 0)),
  );

  /** سجل تراكمي مرتب من الأقدم للأحدث مع الرصيد بعد كل عملية */
  readonly personalVaultLedger = computed(() => {
    const sorted = [...this.payoutHistory()].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id.localeCompare(b.id),
    );
    let running = 0;
    return sorted.map((payout) => {
      running = round2(running + payout.amount);
      return { payout, runningTotal: running };
    });
  });

  constructor() {
    const saved = this.read();
    this.manualPaidMap.set(saved.manualPaidMap);
    this.payoutHistory.set(saved.payoutHistory);
  }

  isChecked(id: string): boolean {
    if (this.settledById().has(id)) return true;
    const map = this.manualPaidMap();
    if (Object.prototype.hasOwnProperty.call(map, id)) return map[id];
    return this.itemById().get(id)?.excelPaid ?? false;
  }

  lifecycle(id: string): ItemLifecycle {
    if (this.settledById().has(id)) return 'settled';
    return this.isChecked(id) ? 'vault' : 'unpaid';
  }

  settledDate(id: string): string | null {
    return this.settledById().get(id)?.date ?? null;
  }

  /** يطلب تأكيد قبل تغيير حالة التسديد */
  toggle(id: string): void {
    if (this.settledById().has(id)) return;
    this.pendingToggleId.set(id);
  }

  confirmToggle(): void {
    const id = this.pendingToggleId();
    this.pendingToggleId.set(null);
    if (!id || this.settledById().has(id)) return;

    const next = !this.isChecked(id);
    this.manualPaidMap.update((map) => ({ ...map, [id]: next }));
    this.persist();
    if (next) {
      const item = this.itemById().get(id);
      const label = item?.label ?? (item?.kind === 'downPayment' ? downPaymentLabel() : 'قسط دوري');
      this.toast.success(`تم إضافة ${label} إلى الخزنة`);
    }
  }

  cancelToggle(): void {
    this.pendingToggleId.set(null);
  }

  openPayoutModal(today: string): void {
    if (this.vaultBalance() === 0) return;
    this.payoutDate.set(today);
    this.payoutNote.set('');
    this.payoutSearch.set('');
    const selected: Record<string, boolean> = {};
    for (const item of this.inVaultItems()) selected[item.id] = true;
    this.payoutSelectedIds.set(selected);
    this.previewOpen.set(true);
    this.modalOpen.set(true);
  }

  isPayoutSelected(id: string): boolean {
    return this.payoutSelectedIds()[id] !== false;
  }

  togglePayoutSelection(id: string): void {
    this.payoutSelectedIds.update((map) => ({ ...map, [id]: !this.isPayoutSelected(id) }));
  }

  selectAllPayoutItems(): void {
    const selected: Record<string, boolean> = {};
    for (const item of this.inVaultItems()) selected[item.id] = true;
    this.payoutSelectedIds.set(selected);
  }

  clearPayoutSelection(): void {
    const selected: Record<string, boolean> = {};
    for (const item of this.inVaultItems()) selected[item.id] = false;
    this.payoutSelectedIds.set(selected);
  }

  confirmPayout(dateIso: string): void {
    const items = this.selectedPayoutItems();
    if (!items.length) return;
    const record: PayoutRecord = {
      id: `PAY_${Date.now()}`,
      date: dateIso,
      amount: round2(items.reduce((sum, item) => sum + item.partnerShare, 0)),
      note: this.payoutNote().trim(),
      settledItemIds: items.map((item) => item.id),
      itemsCount: items.length,
    };
    this.payoutHistory.update((list) => [...list, record]);
    this.modalOpen.set(false);
    this.payoutSelectedIds.set({});
    this.persist();
  }

  undoLastPayout(): void {
    const list = this.payoutHistory();
    if (!list.length) return;
    this.payoutHistory.set(list.slice(0, -1));
    this.undoOpen.set(false);
    this.persist();
  }

  exportJson(): string {
    const payload: VaultBackup = {
      manualPaidMap: this.manualPaidMap(),
      payoutHistory: this.payoutHistory(),
    };
    return JSON.stringify(payload, null, 2);
  }

  replaceVaultState(
    manualPaidMap: Record<string, boolean>,
    payoutHistory: PayoutRecord[],
    updatedAt?: string,
  ): void {
    this.manualPaidMap.set(manualPaidMap);
    this.payoutHistory.set(payoutHistory);
    this.importError.set(null);
    this.persist(updatedAt);
  }

  importJson(raw: string): void {
    const parsed = JSON.parse(raw) as Partial<VaultBackup>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('ملف النسخة الاحتياطية غير صالح');
    }
    const manualPaidMap = parsed.manualPaidMap ?? {};
    const payoutHistory = parsed.payoutHistory ?? [];
    if (typeof manualPaidMap !== 'object' || Array.isArray(manualPaidMap) || !Array.isArray(payoutHistory)) {
      throw new Error('ملف النسخة الاحتياطية غير صالح');
    }
    this.manualPaidMap.set(manualPaidMap as Record<string, boolean>);
    this.payoutHistory.set(payoutHistory as PayoutRecord[]);
    this.importError.set(null);
    this.persist();
  }

  private persist(updatedAt?: string): void {
    const payload: VaultBackup = {
      manualPaidMap: this.manualPaidMap(),
      payoutHistory: this.payoutHistory(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    writeLocalUpdatedAt(updatedAt ?? new Date().toISOString());
  }

  private read(): VaultBackup {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { manualPaidMap: {}, payoutHistory: [] };
      const parsed = JSON.parse(raw) as VaultBackup;
      return {
        manualPaidMap: parsed.manualPaidMap ?? {},
        payoutHistory: parsed.payoutHistory ?? [],
      };
    } catch {
      return { manualPaidMap: {}, payoutHistory: [] };
    }
  }
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
