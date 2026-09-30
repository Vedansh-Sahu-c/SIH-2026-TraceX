import { useState } from 'react';
import type { CaseState, Chain, DataMode } from '../types';
import { extractAddresses, extractTxHashes, detectChain } from '../engine';
import { buildDemoStateTron, buildDemoStateEth, DEMO_CASE_TRON, DEMO_CASE_ETHEREUM } from '../demoData';
import { fetchWithTimeout } from '../liveApi';

interface Props {
  caseState: CaseState;
  labels: string[];
  onSubmit: (state: CaseState) => void;
  onLoadDemo: (state: CaseState) => void;
  onLiveFetch: (state: CaseState) => void;
  dataMode: DataMode;
}

export default function Intake({ caseState, onSubmit, onLoadDemo, onLiveFetch, dataMode }: Props) {
  const [caseId, setCaseId] = useState(caseState.caseId || '');
  const [complaint, setComplaint] = useState(caseState.complaintText || '');
  const [extracted, setExtracted] = useState<{
    addresses: string[];
    txHashes: string[];
    chain: Chain | null;
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [liveAddress, setLiveAddress] = useState('');
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);

  function handleExtract() {
    const addresses = extractAddresses(complaint);
    const txHashes = extractTxHashes(complaint);
    const chain = addresses.length > 0 ? detectChain(addresses[0]) : null;
    setExtracted({ addresses, txHashes, chain });
    setConfirmed(false);
  }

  function handleConfirm() {
    if (!extracted || !extracted.chain) return;
    const state: CaseState = {
      caseId: caseId || `CASE-${Date.now()}`,
      complaintText: complaint,
      chain: extracted.chain,
      suspectAddress: extracted.addresses[0] || null,
      txHashes: extracted.txHashes,
      extractedAddresses: extracted.addresses,
      dataMode: 'demo',
      graph: null,
      traceResult: null,
      feedback: {},
      createdAt: new Date().toISOString(),
    };
    setConfirmed(true);
    onSubmit(state);
  }

  function handleDemoTron() {
    onLoadDemo(buildDemoStateTron());
    setCaseId(DEMO_CASE_TRON.caseId);
    setComplaint(DEMO_CASE_TRON.complaintText);
    const addresses = extractAddresses(DEMO_CASE_TRON.complaintText);
    setExtracted({ addresses, txHashes: DEMO_CASE_TRON.txHashes, chain: 'tron' });
  }

  function handleDemoEth() {
    onLoadDemo(buildDemoStateEth());
    setCaseId(DEMO_CASE_ETHEREUM.caseId);
    setComplaint(DEMO_CASE_ETHEREUM.complaintText);
    const addresses = extractAddresses(DEMO_CASE_ETHEREUM.complaintText);
    setExtracted({ addresses, txHashes: DEMO_CASE_ETHEREUM.txHashes, chain: 'ethereum' });
  }

  async function handleLiveFetch() {
    if (!liveAddress.trim()) return;
    const chain = detectChain(liveAddress.trim());
    if (chain !== 'tron') {
      setLiveError('Live mode is available for Tron addresses only. Ethereum and Bitcoin are planned.');
      return;
    }
    setLiveLoading(true);
    setLiveError(null);
    try {
      const graph = await fetchWithTimeout(liveAddress.trim());
      const state: CaseState = {
        caseId: caseId || `CASE-${Date.now()}`,
        complaintText: complaint,
        chain: 'tron',
        suspectAddress: liveAddress.trim(),
        txHashes: [],
        extractedAddresses: [liveAddress.trim()],
        dataMode: 'live',
        graph,
        traceResult: null,
        feedback: {},
        createdAt: new Date().toISOString(),
      };
      onLiveFetch(state);
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : 'Failed to fetch live data.');
    } finally {
      setLiveLoading(false);
    }
  }

  const chainDisabled: Record<Chain, boolean> = { tron: false, ethereum: true, bitcoin: true };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Case Intake</h2>
        {dataMode === 'demo' && <DemoBadge />}
        {dataMode === 'live' && <LiveBadge />}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Case ID</label>
          <input
            type="text"
            value={caseId}
            onChange={(e) => setCaseId(e.target.value)}
            placeholder="e.g. CASE-2026-001"
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1">Complaint Text</label>
          <textarea
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
            rows={6}
            placeholder="Paste the complaint. TraceX will extract wallet addresses and transaction hashes."
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExtract}
            className="rounded-md bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Extract & Detect
          </button>
          <button
            onClick={handleDemoTron}
            className="rounded-md border border-slate-600 hover:border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
          >
            Load demo case (Tron USDT)
          </button>
          <button
            onClick={handleDemoEth}
            className="rounded-md border border-slate-600 hover:border-slate-500 px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
          >
            Load demo case (Ethereum)
          </button>
        </div>
      </div>

      {extracted && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Extracted Items</h3>
          <div className="text-xs text-slate-400">
            <span className="font-medium text-slate-300">Detected chain: </span>
            {extracted.chain ? (
              <span className="text-cyan-400 uppercase">{extracted.chain}</span>
            ) : (
              <span className="text-amber-400">Unknown</span>
            )}
          </div>
          {extracted.addresses.length > 0 ? (
            <div>
              <p className="text-xs text-slate-400 mb-1">Wallet addresses:</p>
              <ul className="space-y-1">
                {extracted.addresses.map((a) => (
                  <li key={a} className="text-xs font-mono text-slate-200 bg-slate-800 rounded px-2 py-1">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-amber-400">No wallet addresses found in the complaint.</p>
          )}
          {extracted.txHashes.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 mb-1">Transaction hashes:</p>
              <ul className="space-y-1">
                {extracted.txHashes.map((h) => (
                  <li key={h} className="text-xs font-mono text-slate-200 bg-slate-800 rounded px-2 py-1">
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={!extracted.chain}
            className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors"
          >
            Confirm & Start Trace
          </button>
          {confirmed && (
            <p className="text-xs text-emerald-400">Case confirmed. Switch to the Trace tab.</p>
          )}
        </div>
      )}

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-200">Live Mode (Tron only)</h3>
        <p className="text-xs text-slate-400">
          Fetch live TRC20 USDT transfers from the public TronGrid API. Only the wallet address you enter is sent to the API — no personal data is ever transmitted.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={liveAddress}
            onChange={(e) => setLiveAddress(e.target.value)}
            placeholder="T... (Tron address)"
            className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-slate-100 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <button
            onClick={handleLiveFetch}
            disabled={liveLoading}
            className="rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap"
          >
            {liveLoading ? 'Fetching...' : 'Fetch Live Data'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Chain:</span>
          {(['tron', 'ethereum', 'bitcoin'] as Chain[]).map((c) => (
            <span
              key={c}
              className={`text-xs px-2 py-0.5 rounded ${
                chainDisabled[c]
                  ? 'bg-slate-800 text-slate-500 line-through'
                  : 'bg-emerald-900/40 text-emerald-400'
              }`}
            >
              {c}
            </span>
          ))}
        </div>
        {liveError && (
          <div className="rounded-md border border-red-800 bg-red-950/40 p-3 text-xs text-red-300 flex items-center justify-between">
            <span>{liveError}</span>
            <button
              onClick={handleLiveFetch}
              className="ml-3 rounded border border-red-700 px-2 py-0.5 hover:bg-red-900/40 text-red-300"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
      SEEDED DEMO DATA
    </span>
  );
}

export function LiveBadge() {
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
      LIVE
    </span>
  );
}
