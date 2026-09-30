import { useState, useEffect, useCallback } from 'react';
import { Shield, FileSearch, Network, Target, FileText, BookOpen, Database } from 'lucide-react';
import type { CaseState, TraceResult, GraphNode, DataMode, LabelEntry, LedgerRecord } from './types';
import { runTrace, type SearchCallbacks } from './engine';
import { appendLedgerEvent, readLedger } from './ledger';
import Intake from './components/Intake';
import TraceView from './components/TraceView';
import ResultView from './components/ResultView';
import RequestPackage from './components/RequestPackage';
import LedgerView from './components/LedgerView';
import About from './components/About';
import LabelsPanel from './components/LabelsPanel';

type Tab = 'intake' | 'trace' | 'result' | 'request' | 'ledger' | 'about';

const TABS: { id: Tab; label: string; icon: typeof Shield }[] = [
  { id: 'intake', label: 'Intake', icon: FileSearch },
  { id: 'trace', label: 'Trace', icon: Network },
  { id: 'result', label: 'Result', icon: Target },
  { id: 'request', label: 'Request', icon: FileText },
  { id: 'ledger', label: 'Ledger', icon: Database },
  { id: 'about', label: 'About', icon: BookOpen },
];

const FOOTER_TEXT =
  'A wallet owner cannot be identified from the chain alone. TraceX finds the right VASP fast, so a lawful request can be served while funds can still be frozen.';

function loadState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveState<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function App() {
  const [tab, setTab] = useState<Tab>('intake');
  const [caseState, setCaseState] = useState<CaseState>(() =>
    loadState<CaseState>('tracex_case', {
      caseId: '',
      complaintText: '',
      chain: null,
      suspectAddress: null,
      txHashes: [],
      extractedAddresses: [],
      dataMode: 'none' as DataMode,
      graph: null,
      traceResult: null,
      feedback: {},
      createdAt: '',
    })
  );
  const [labels, setLabels] = useState<LabelEntry[]>(() => loadState<LabelEntry[]>('tracex_labels', []));
  const [ledgerRecords, setLedgerRecords] = useState<LedgerRecord[]>(() => readLedger());
  const [hopsUsed, setHopsUsed] = useState(0);
  const [apiCallsUsed, setApiCallsUsed] = useState(0);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [tracing, setTracing] = useState(false);

  const hopBudget = 6;
  const apiCallBudget = 40;

  useEffect(() => saveState('tracex_case', caseState), [caseState]);
  useEffect(() => saveState('tracex_labels', labels), [labels]);

  const logEvent = useCallback(async (eventType: 'case_created' | 'trace_run' | 'result' | 'request_generated' | 'feedback', payload: unknown) => {
    await appendLedgerEvent(caseState.caseId, eventType, payload);
    setLedgerRecords(readLedger());
  }, [caseState.caseId]);

  function handleSubmitCase(state: CaseState) {
    setCaseState(state);
    setHopsUsed(0);
    setApiCallsUsed(0);
    setSelectedNode(null);
    logEvent('case_created', { caseId: state.caseId, chain: state.chain, suspect: state.suspectAddress });
    setTab('trace');
  }

  function handleLoadDemo(state: CaseState) {
    setCaseState(state);
    setHopsUsed(0);
    setApiCallsUsed(0);
    setSelectedNode(null);
    logEvent('case_created', { caseId: state.caseId, chain: state.chain, demo: true });
    setTab('trace');
  }

  function handleLiveFetch(state: CaseState) {
    setCaseState(state);
    setHopsUsed(0);
    setApiCallsUsed(0);
    setSelectedNode(null);
    logEvent('case_created', { caseId: state.caseId, chain: 'tron', live: true });
    setTab('trace');
  }

  function handleRunTrace() {
    if (!caseState.graph || !caseState.suspectAddress) return;
    const suspectNode = caseState.graph.nodes.find(
      (n) => n.address === caseState.suspectAddress || n.type === 'suspect'
    );
    if (!suspectNode) return;

    setTracing(true);
    setHopsUsed(0);
    setApiCallsUsed(0);

    const cb: SearchCallbacks = {
      hopBudget,
      apiCallBudget,
      labels,
      onCounters: (h, a) => {
        setHopsUsed(h);
        setApiCallsUsed(a);
      },
    };

    // Run synchronously but wrap in setTimeout for UI counter updates
    const prevResult = caseState.traceResult;
    setTimeout(() => {
      const result = runTrace(caseState.graph!, suspectNode.id, cb);
      setCaseState((prev) => ({ ...prev, traceResult: result }));
      setTracing(false);
      // Skip ledger entry if result is identical to previous (same candidates)
      const resultSig = JSON.stringify(
        result.candidates.map((c) => ({ vasp: c.vaspName, conf: c.confidence, hop: c.hopDistance }))
      );
      const prevSig = prevResult
        ? JSON.stringify(
            prevResult.candidates.map((c) => ({ vasp: c.vaspName, conf: c.confidence, hop: c.hopDistance }))
          )
        : null;
      if (resultSig !== prevSig) {
        logEvent('trace_run', {
          caseId: caseState.caseId,
          candidates: result.candidates.map((c) => ({ vasp: c.vaspName, confidence: c.confidence })),
          counters: result.counters,
        });
      }
    }, 100);
  }

  function handleFeedback(vaspName: string, type: 'confirmed' | 'not_customer') {
    const newFeedback = { ...caseState.feedback, [vaspName]: type };
    setCaseState((prev) => ({ ...prev, feedback: newFeedback }));
    // add to labels
    const candidate = caseState.traceResult?.candidates.find((c) => c.vaspName === vaspName);
    if (candidate) {
      const newLabel: LabelEntry = {
        address: candidate.address,
        entity: vaspName,
        type: 'vasp',
        source: 'feedback',
      };
      setLabels((prev) => {
        const filtered = prev.filter((l) => l.address !== newLabel.address);
        return [...filtered, newLabel];
      });
    }
    logEvent('feedback', { vaspName, type });
  }

  function handleRequestGenerated() {
    logEvent('request_generated', { caseId: caseState.caseId, vasp: caseState.traceResult?.candidates[0]?.vaspName });
  }

  function handleImportLabels(entries: LabelEntry[]) {
    setLabels((prev) => {
      const existing = new Map(prev.map((l) => [l.address.toLowerCase(), l]));
      for (const e of entries) existing.set(e.address.toLowerCase(), e);
      return [...existing.values()];
    });
  }

  function handleAddLabel(entry: LabelEntry) {
    setLabels((prev) => [...prev, entry]);
  }

  function handleClearLabels() {
    setLabels([]);
  }

  const dataMode: DataMode = caseState.dataMode;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-cyan-400" />
            <span className="text-lg font-bold tracking-tight">TraceX</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-cyan-950/50 text-cyan-400 border border-cyan-900/50">
              Prototype
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            {caseState.caseId && <span>Case: <span className="text-slate-200 font-mono">{caseState.caseId}</span></span>}
            {dataMode === 'demo' && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">SEEDED DEMO DATA</span>}
            {dataMode === 'live' && <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">LIVE</span>}
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex gap-1 -mb-px">
            {TABS.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                    tab === t.id
                      ? 'border-cyan-500 text-cyan-400'
                      : 'border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {tab === 'intake' && (
          <div className="space-y-4">
            <Intake
              caseState={caseState}
              labels={[]}
              dataMode={dataMode}
              onSubmit={handleSubmitCase}
              onLoadDemo={handleLoadDemo}
              onLiveFetch={handleLiveFetch}
            />
            <LabelsPanel
              labels={labels}
              onImport={handleImportLabels}
              onAdd={handleAddLabel}
              onClear={handleClearLabels}
            />
          </div>
        )}
        {tab === 'trace' && (
          caseState.graph ? (
            <TraceView
              graph={caseState.graph}
              traceResult={caseState.traceResult}
              dataMode={dataMode}
              hopBudget={hopBudget}
              apiCallBudget={apiCallBudget}
              hopsUsed={hopsUsed}
              apiCallsUsed={apiCallsUsed}
              onRunTrace={handleRunTrace}
              onNodeClick={setSelectedNode}
              selectedNode={selectedNode}
              tracing={tracing}
            />
          ) : (
            <div className="text-center text-slate-400 py-20 text-sm">
              No case loaded. Go to Intake and load a demo case or enter a complaint.
            </div>
          )
        )}
        {tab === 'result' && (
          caseState.traceResult && caseState.traceResult.candidates.length > 0 ? (
            <ResultView
              traceResult={caseState.traceResult}
              caseState={caseState}
              dataMode={dataMode}
              feedback={caseState.feedback}
              onFeedback={handleFeedback}
            />
          ) : (
            <div className="text-center text-slate-400 py-20 text-sm">
              No results yet. Run a trace from the Trace tab first.
            </div>
          )
        )}
        {tab === 'request' && (
          caseState.traceResult ? (
            <RequestPackage
              caseState={caseState}
              traceResult={caseState.traceResult}
              dataMode={dataMode}
              onGenerated={handleRequestGenerated}
            />
          ) : (
            <div className="text-center text-slate-400 py-20 text-sm">
              No trace result. Run a trace first.
            </div>
          )
        )}
        {tab === 'ledger' && (
          <LedgerView records={ledgerRecords} onRefresh={() => setLedgerRecords(readLedger())} />
        )}
        {tab === 'about' && <About />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/80 py-3">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-xs text-slate-500">{FOOTER_TEXT}</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
