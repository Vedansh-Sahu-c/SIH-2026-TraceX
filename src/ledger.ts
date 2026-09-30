import type { LedgerRecord, EventType } from './types';

const STORAGE_KEY = 'tracex_ledger';
const ENTRIES_KEY = 'tracex_ledger_entries';

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function computeHash(
  timestamp: string,
  caseId: string,
  eventType: EventType,
  payloadHash: string,
  prevHash: string
): Promise<string> {
  return sha256Hex(timestamp + caseId + eventType + payloadHash + prevHash);
}

export function readLedger(): LedgerRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as LedgerRecord[];
  } catch {
    return [];
  }
}

function writeLedger(records: LedgerRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

// we store the raw payload strings separately so tamper-simulation can edit
function readPayloads(): Record<number, string> {
  try {
    const raw = localStorage.getItem(ENTRIES_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<number, string>;
  } catch {
    return {};
  }
}

function writePayloads(map: Record<number, string>) {
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(map));
}

export async function appendLedgerEvent(
  caseId: string,
  eventType: EventType,
  payload: unknown
): Promise<LedgerRecord> {
  const records = readLedger();
  const payloads = readPayloads();
  const payloadStr = JSON.stringify(payload);
  const payloadHash = await sha256Hex(payloadStr);
  const prevHash = records.length > 0 ? records[records.length - 1].hash : '0'.repeat(64);
  const timestamp = new Date().toISOString();
  const index = records.length;
  const hash = await computeHash(timestamp, caseId, eventType, payloadHash, prevHash);
  const record: LedgerRecord = {
    index,
    timestamp,
    caseId,
    eventType,
    payloadHash,
    prevHash,
    hash,
    payloadPreview: payloadStr.slice(0, 200),
  };
  records.push(record);
  payloads[index] = payloadStr;
  writeLedger(records);
  writePayloads(payloads);
  return record;
}

export interface VerifyResult {
  ok: boolean;
  brokenIndex?: number;
  message: string;
}

export async function verifyLedger(): Promise<VerifyResult> {
  const records = readLedger();
  if (records.length === 0) {
    return { ok: true, message: 'Ledger is empty.' };
  }
  let prevHash = '0'.repeat(64);
  for (let i = 0; i < records.length; i++) {
    const r = records[i];
    if (r.prevHash !== prevHash) {
      return { ok: false, brokenIndex: i, message: `CHAIN BROKEN at #${i}: prevHash mismatch.` };
    }
    const expected = await computeHash(r.timestamp, r.caseId, r.eventType, r.payloadHash, r.prevHash);
    if (expected !== r.hash) {
      return { ok: false, brokenIndex: i, message: `CHAIN BROKEN at #${i}: hash mismatch.` };
    }
    prevHash = r.hash;
  }
  return { ok: true, message: `Chain intact (${records.length} records verified).` };
}

export function simulateTampering(): boolean {
  const records = readLedger();
  if (records.length === 0) return false;
  const idx = Math.floor(records.length / 2);
  records[idx].payloadPreview = '[TAMPERED] ' + records[idx].payloadPreview;
  writeLedger(records);
  return true;
}

export function clearLedger() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ENTRIES_KEY);
}
