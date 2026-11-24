import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { Contract, Installment, InstallmentStatus, ParsedWorkbook, Withdrawal } from '../models/dashboard.models';
import { assignStableIds } from '../utils/stable-ids';

const PARTNER_RATE = 0.07;
const COMMISSION_RATE = 0.05;

@Injectable({ providedIn: 'root' })
export class ExcelParserService {
  async parseFile(file: File): Promise<ParsedWorkbook> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
    const contracts = this.parseClients(workbook);
    this.enrichGarages(workbook, contracts);
    assignStableIds(contracts);
    const { withdrawals, totalWithdrawn } = this.parseTreasury(workbook);
    return {
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      contracts,
      withdrawals,
      totalWithdrawn,
    };
  }

  private parseClients(workbook: XLSX.WorkBook): Contract[] {
    const sheet = this.findSheet(workbook, 'عملاء 86');
    if (!sheet) {
      throw new Error('لم يتم العثور على شيت العملاء (عملاء 86)');
    }
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    if (!rows.length) return [];

    const headers = (rows[0] ?? []).map((cell) => cleanHeader(cell));
    const col = (name: string) => headers.findIndex((h) => h === name);

    const iCode = col('كود العميل');
    const iName = col('إسم العميل');
    const iUnit = col('رقم الشقة');
    const iFloor = col('الطابق');
    const iArea = col('المساحة');
    const iPrice = col('ثمن الوحدة');
    const iGarage = col('ثمن الجراج');
    const iTotal = col('إجمالى مبلغ التعاقد');
    const iDate = col('التاريخ');
    const iDown = col('مقدم الحجز');
    const iDue = col('تاريخ الإستحقاق');
    const iInst = col('نظام الأقساط بالعقد');
    const iPaidDate = col('تاريخ السداد');
    const iPaid = col('المسدد');
    const iRemain = col('رصيد الأقساط');

    const contracts: Contract[] = [];
    let current: Contract | null = null;
    const today = startOfToday();

    for (const row of rows.slice(1)) {
      const unitPrice = toNumber(cell(row, iPrice));
      const installmentAmount = toNumber(cell(row, iInst));

      if (unitPrice !== null) {
        const price = unitPrice;
        const garage = toNumber(cell(row, iGarage)) ?? 0;
        const down = toNumber(cell(row, iDown)) ?? 0;
        const commission5Pct = round2(price * COMMISSION_RATE);
        const netDownPayment = round2(down - commission5Pct);
        current = {
          clientCode: text(cell(row, iCode)),
          clientName: text(cell(row, iName)),
          unitNumber: text(cell(row, iUnit)),
          floor: text(cell(row, iFloor)),
          area: toNumber(cell(row, iArea)),
          unitPrice: price,
          garagePrice: garage,
          totalContract: toNumber(cell(row, iTotal)) ?? round2(price + garage),
          downPayment: down,
          contractDate: toIsoDate(cell(row, iDate)),
          commission5Pct,
          netDownPayment,
          partnerDownPaymentShare: round2(netDownPayment * PARTNER_RATE),
          downPaymentId: '',
          installments: [],
        };
        contracts.push(current);
        continue;
      }

      if (installmentAmount !== null && current) {
        const paidAmount = toNumber(cell(row, iPaid)) ?? 0;
        const remainingAmount = toNumber(cell(row, iRemain)) ?? 0;
        const dueDate = toIsoDate(cell(row, iDue));
        const installment: Installment = {
          id: '',
          dueDate,
          amount: installmentAmount,
          paidDate: toIsoDate(cell(row, iPaidDate)),
          paidAmount,
          remainingAmount,
          status: installmentStatus(remainingAmount, paidAmount, dueDate, today),
          partnerPaidShare: round2(paidAmount * PARTNER_RATE),
          partnerRemainingShare: round2(remainingAmount * PARTNER_RATE),
        };
        const unit = text(cell(row, iUnit));
        const name = text(cell(row, iName));
        if (
          (unit && unit !== current.unitNumber) ||
          (name && name !== current.clientName)
        ) {
          const match = [...contracts].reverse().find(
            (c) => (!unit || c.unitNumber === unit) && (!name || c.clientName === name),
          );
          (match ?? current).installments.push(installment);
        } else {
          current.installments.push(installment);
        }
      }
    }

    return contracts;
  }

  /**
   * Pull garage prices / partial garage deals from the partner statement sheet
   * and treasury "جراج" receipts, then attach missing garage installments.
   */
  private enrichGarages(workbook: XLSX.WorkBook, contracts: Contract[]): void {
    const partnerGarages = this.parsePartnerGarages(workbook);
    const garageReceipts = this.parseGarageReceipts(workbook);
    const today = startOfToday();

    for (const pg of partnerGarages) {
      let contract = contracts.find((c) => c.unitNumber === pg.unitNumber);
      if (!contract && pg.unitNumber) {
        contract = {
          clientCode: '',
          clientName: pg.clientName || `جراج ${pg.unitNumber}`,
          unitNumber: pg.unitNumber,
          floor: pg.floor,
          area: pg.area,
          unitPrice: 0,
          garagePrice: pg.garagePrice,
          totalContract: pg.garagePrice,
          downPayment: pg.downPayment,
          contractDate: null,
          commission5Pct: 0,
          netDownPayment: pg.downPayment,
          partnerDownPaymentShare: round2(pg.downPayment * PARTNER_RATE),
          downPaymentId: '',
          installments: [],
          garageOnly: true,
        };
        contracts.push(contract);
      }
      if (!contract) continue;

      if ((contract.garagePrice ?? 0) <= 0 && pg.garagePrice > 0) {
        contract.garagePrice = pg.garagePrice;
        if (!contract.garageOnly) {
          contract.totalContract = round2((contract.unitPrice || 0) + pg.garagePrice);
        }
      }

      const receipts = garageReceipts.filter((r) => r.unitNumber === contract!.unitNumber);
      const receiptTotal = round2(receipts.reduce((sum, r) => sum + r.amount, 0));
      // Partner "مقدم" is only a garage payment when the row is garage-focused
      // (no unit price, or down payment ≤ garage price).
      const partnerGaragePaid =
        pg.unitPrice <= 0 && pg.downPayment > 0
          ? pg.downPayment
          : pg.downPayment > 0 && pg.downPayment <= pg.garagePrice
            ? pg.downPayment
            : 0;
      const received = receiptTotal > 0 ? receiptTotal : partnerGaragePaid;

      const existingGaragePaid = contract.installments
        .filter((i) => near(i.amount, contract!.garagePrice) || (contract!.garageOnly && i.paidAmount > 0))
        .reduce((sum, i) => sum + i.paidAmount, 0);

      // Paid chunk from treasury / partner down that isn't already an installment line
      if (received > 0 && existingGaragePaid + 1 < received) {
        const paidChunk = round2(received - existingGaragePaid);
        if (paidChunk > 0) {
          const receiptDate = receipts[0]?.date ?? null;
          contract.installments.unshift({
            id: '',
            dueDate: receiptDate,
            amount: paidChunk,
            paidDate: receiptDate,
            paidAmount: paidChunk,
            remainingAmount: 0,
            status: 'paid',
            partnerPaidShare: round2(paidChunk * PARTNER_RATE),
            partnerRemainingShare: 0,
            scheduleLabel: 'جراج',
          });
        }
      }

      const garagePrice = contract.garagePrice ?? 0;
      if (garagePrice <= 0) continue;

      // If apartment schedule already finances (total − down), garage is blended — don't add a duplicate.
      const scheduleSum = round2(contract.installments.reduce((sum, i) => sum + i.amount, 0));
      const financedRemain = round2(contract.totalContract - (contract.downPayment ?? 0));
      const scheduleShortfall = round2(financedRemain - scheduleSum);
      if (scheduleShortfall <= 50) continue;

      const labeledOrMatching = contract.installments.filter(
        (i) => i.scheduleLabel === 'جراج' || near(i.amount, garagePrice) || contract.garageOnly,
      );
      const covered = round2(labeledOrMatching.reduce((sum, i) => sum + i.amount, 0));
      const remaining = round2(Math.min(garagePrice - covered, scheduleShortfall));
      if (remaining > 50) {
        contract.installments.push({
          id: '',
          dueDate: null,
          amount: remaining,
          paidDate: null,
          paidAmount: 0,
          remainingAmount: remaining,
          status: installmentStatus(remaining, 0, null, today),
          partnerPaidShare: 0,
          partnerRemainingShare: round2(remaining * PARTNER_RATE),
          scheduleLabel: 'جراج',
        });
      }
    }
  }

  private parsePartnerGarages(workbook: XLSX.WorkBook): PartnerGarageRow[] {
    const sheet =
      this.findSheet(workbook, 'بيان حساب أ. عمرو حمدى') ??
      workbook.SheetNames.map((n) => workbook.Sheets[n]).find((s) => {
        const sample = XLSX.utils.sheet_to_json<(string | number | null)[]>(s, {
          header: 1,
          defval: null,
          raw: true,
        });
        return sample.some((row) => cleanHeader(row?.[5]).includes('ثمن الجراج') || cleanHeader(row?.[5]) === 'ثمن الجراج');
      });
    if (!sheet) return [];

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    const result: PartnerGarageRow[] = [];
    for (const row of rows) {
      const garage = toNumber(row?.[5]);
      const unitRaw = row?.[2];
      if (garage == null || garage <= 0) continue;
      if (unitRaw == null || cleanHeader(unitRaw) === 'رقم الشقة') continue;
      const unitNumber = text(unitRaw);
      if (!unitNumber) continue;
      result.push({
        unitNumber,
        floor: text(row?.[1]),
        area: toNumber(row?.[3]),
        unitPrice: toNumber(row?.[4]) ?? 0,
        garagePrice: garage,
        downPayment: toNumber(row?.[7]) ?? 0,
        clientName: '',
      });
    }
    return result;
  }

  private parseGarageReceipts(workbook: XLSX.WorkBook): GarageReceipt[] {
    const sheet = this.findSheet(workbook, 'خزينة');
    if (!sheet) return [];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    if (!rows.length) return [];
    const headers = (rows[0] ?? []).map((cell) => cleanHeader(cell));
    const iDate = headers.findIndex((h) => h === 'تاريخ');
    const iRecv = headers.findIndex((h) => h === 'مقبوضات');
    const iUnit = headers.findIndex((h) => h === 'رقم الوحدة');
    const iName = headers.findIndex((h) => h === 'حساب فرعى' || h === 'حساب فرعي');
    const iNote = headers.findIndex((h) => h.startsWith('بيان'));

    const receipts: GarageReceipt[] = [];
    for (const row of rows.slice(1)) {
      const note = text(cell(row, iNote));
      if (!note.includes('جراج')) continue;
      const amount = toNumber(cell(row, iRecv)) ?? 0;
      if (amount <= 0) continue;
      receipts.push({
        unitNumber: text(cell(row, iUnit)),
        clientName: text(cell(row, iName)),
        amount,
        date: toIsoDate(cell(row, iDate)),
      });
    }
    return receipts;
  }

  private parseTreasury(workbook: XLSX.WorkBook): { withdrawals: Withdrawal[]; totalWithdrawn: number } {
    const sheet = this.findSheet(workbook, 'خزينة');
    if (!sheet) return { withdrawals: [], totalWithdrawn: 0 };

    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
    });
    if (!rows.length) return { withdrawals: [], totalWithdrawn: 0 };

    const headers = (rows[0] ?? []).map((cell) => cleanHeader(cell));
    const iDate = headers.findIndex((h) => h === 'تاريخ');
    const iPay = headers.findIndex((h) => h === 'مدفوعات');
    const iSub = headers.findIndex((h) => h === 'حساب فرعى');
    const iNote = headers.findIndex((h) => h.startsWith('بيان'));

    const withdrawals: Withdrawal[] = [];
    for (const row of rows.slice(1)) {
      const sub = text(cell(row, iSub));
      const amount = toNumber(cell(row, iPay)) ?? 0;
      if (!sub.includes('عمرو') || amount <= 0) continue;
      withdrawals.push({
        date: toIsoDate(cell(row, iDate)),
        amount,
        description: text(cell(row, iNote)),
      });
    }
    const totalWithdrawn = round2(withdrawals.reduce((sum, w) => sum + w.amount, 0));
    return { withdrawals, totalWithdrawn };
  }

  private findSheet(workbook: XLSX.WorkBook, name: string): XLSX.WorkSheet | undefined {
    const target = name.trim();
    const found = workbook.SheetNames.find((sheetName) => sheetName.trim() === target);
    return found ? workbook.Sheets[found] : undefined;
  }
}

function cell(row: (string | number | null)[], index: number): string | number | null {
  if (index < 0) return null;
  return row[index] ?? null;
}

function cleanHeader(value: unknown): string {
  return String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function text(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const normalized = String(value).replace(/,/g, '').trim();
  if (!normalized) return null;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function toIsoDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate()).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d).toISOString();
  }
  if (typeof value === 'string') {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber) && value.trim() !== '') {
      return toIsoDate(asNumber);
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return null;
}

function installmentStatus(
  remainingAmount: number,
  paidAmount: number,
  dueDate: string | null,
  today: Date,
): InstallmentStatus {
  if (remainingAmount <= 0 && paidAmount > 0) return 'paid';
  if (remainingAmount > 0 && dueDate) {
    const due = new Date(dueDate);
    if (!Number.isNaN(due.getTime()) && due < today) return 'overdue';
  }
  return 'upcoming';
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function near(amount: number, target: number): boolean {
  if (!Number.isFinite(amount) || !Number.isFinite(target) || target === 0) return false;
  return Math.abs(amount - target) <= Math.max(50, Math.abs(target) * 0.005);
}

interface PartnerGarageRow {
  unitNumber: string;
  floor: string;
  area: number | null;
  unitPrice: number;
  garagePrice: number;
  downPayment: number;
  clientName: string;
}

interface GarageReceipt {
  unitNumber: string;
  clientName: string;
  amount: number;
  date: string | null;
}
