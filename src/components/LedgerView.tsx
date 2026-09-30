import { useState } from 'react';
import type { LedgerRecord } from '../types';
import { verifyLedger, simulateTampering, clearLedger, type VerifyResult } from '../ledger';

interface Props {
  records: LedgerRecord[];
  onRefresh: () => void;
}

const eventTypeLabels: Record<string, string> = {
  case_created: 'Case Created',
  trace_run: 'Trace Run',
  result: 'Result Generated',
  request_generated: 'Request Generated',
  feedback: 'Feedback Recorded',
};

export default function LedgerView({ records, onRefresh }: Props) {
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    const result = await verifyLedger();
    setVerifyResult(result);
    setVerifying(false);
  }

  function handleTamper() {
    simulateTampering();
    onRefresh();
    setVerifyResult(null);
  }

  function handleClear() {
    clearLedger();
    onRefresh();
    setVerifyResult(null);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Audit Ledger</h2>
        <span className="text-xs text-slate-500">hash-chained event log (SHA-256)</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 px-3 py-1.5 text-xs font-medium text-white transition-colors"
        >
          {verifying ? 'Verifying...' : 'Verify integrity'}
        </button>
        <button
          onClick={handleTamper}
          className="rounded-md border border-amber-700 text-amber-300 hover:bg-amber-950/30 px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Simulate tampering
        </button>
        <button
          onClick={handleClear}
          className="rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800 px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Clear ledger
        </button>
      </div>

      {verifyResult && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            verifyResult.ok
              ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300'
              : 'border-red-800 bg-red-950/40 text-red-300'
          }`}
        >
          {verifyResult.ok ? '✓ ' : '⚠ '}{verifyResult.message}
        </div>
      )}

      {records.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          No records yet. Actions will appear here as you work.
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-800/60 text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Timestamp</th>
                <th className="px-3 py-2 text-left">Case ID</th>
                <th className="px-3 py-2 text-left">Event</th>
                <th className="px-3 py-2 text-left">Hash (truncated)</th>
                <th className="px-3 py-2 text-left">Prev Hash (truncated)</th>
                <th className="px-3 py-2 text-left">Payload Preview</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {records.map((r) => (
                <tr key={r.index} className="hover:bg-slate-800/30">
                  <td className="px-3 py-2 text-slate-500 font-mono">{r.index}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono">{r.timestamp.slice(0, 19)}</td>
                  <td className="px-3 py-2 text-slate-300 font-mono">{r.caseId}</td>
                  <td className="px-3 py-2 text-slate-200">{eventTypeLabels[r.eventType] || r.eventType}</td>
                  <td className="px-3 py-2 text-cyan-400 font-mono">{r.hash.slice(0, 12)}...</td>
                  <td className="px-3 py-2 text-slate-500 font-mono">{r.prevHash.slice(0, 12)}...</td>
                  <td className="px-3 py-2 text-slate-500 max-w-xs truncate">{r.payloadPreview}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
