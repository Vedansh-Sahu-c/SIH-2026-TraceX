import type { TraceResult, CaseState, DataMode } from '../types';
import { formatAmount, shortAddr } from '../engine';
import { DemoBadge, LiveBadge } from './Intake';

interface Props {
  traceResult: TraceResult;
  caseState: CaseState;
  dataMode: DataMode;
  feedback: Record<string, 'confirmed' | 'not_customer'>;
  onFeedback: (vaspName: string, type: 'confirmed' | 'not_customer') => void;
}

export default function ResultView({
  traceResult,
  caseState,
  dataMode,
  feedback,
  onFeedback,
}: Props) {
  const count = traceResult.candidates.length;
  const heading =
    count === 0 ? 'VASP Candidates' :
    count === 1 ? 'Top candidate' :
    count === 2 ? 'Top candidates' :
    'Top-3 candidates';

  const suspectNode = caseState.graph?.nodes.find((n) => n.type === 'suspect');
  const totalSuspectOut = suspectNode
    ? caseState.graph?.edges
        .filter((e) => e.source === suspectNode.id)
        .reduce((s, e) => s + e.amount, 0) ?? 0
    : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-100">{heading}</h2>
        {dataMode === 'demo' && <DemoBadge />}
        {dataMode === 'live' && <LiveBadge />}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs text-slate-400">
        <span className="font-medium text-slate-300">Confidence formula: </span>
        base 0.90 provider label, 0.80 curated public label, 0.60 behaviour only; ×0.85 per hop; independent sources combined via noisy-OR; capped at 0.95.
        Ranking: confidence desc, then shorter hop distance, then higher recoverable amount.
      </div>

      {count === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          No VASP candidates found within the hop and API-call budget.
        </div>
      )}

      <div className="space-y-3">
        {traceResult.candidates.map((c, i) => (
          <div
            key={c.vaspName + c.address}
            className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-500">#{i + 1}</span>
                  <h3 className="text-base font-semibold text-slate-100">{c.vaspName}</h3>
                </div>
                <p className="text-xs font-mono text-slate-400 mt-0.5 break-all">{c.address}</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-cyan-400">{(c.confidence * 100).toFixed(0)}%</div>
                <div className="text-xs text-slate-500">confidence</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Stat label="Hop distance" value={`${c.hopDistance}`} />
              <Stat label="Recoverable" value={formatAmount(c.recoverableAmount, c.recoverableToken)} />
              <Stat label="Freeze urgency" value={`${c.freezeUrgency}/100`} />
              <Stat label="Chain" value={c.chain} />
            </div>

            {/* Freeze urgency breakdown */}
            <div className="rounded-md border border-slate-700 bg-slate-800/40 p-2">
              <p className="text-xs font-semibold text-slate-300 mb-1">Freeze urgency breakdown</p>
              <div className="space-y-1">
                {c.freezeBreakdown.map((b) => (
                  <div key={b.label} className="flex justify-between text-xs">
                    <span className="text-slate-400">{b.label}</span>
                    <span className="font-mono text-slate-300">{b.value}/100</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence list */}
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">Evidence</p>
              <ul className="space-y-1.5">
                {c.evidence.map((ev, j) => (
                  <li key={j} className="rounded border border-slate-700 bg-slate-800/50 p-2 text-xs">
                    <div className="flex justify-between">
                      <span className="font-medium text-slate-200">{ev.sourceLabel}</span>
                      <span className="text-slate-400">hop {ev.hopDistance} · {(ev.contribution * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-slate-400 mt-0.5">{ev.detail}</p>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recoverable amount hop table */}
            {c.hopSteps.length > 0 && (
              <div className="rounded-md border border-slate-700 bg-slate-800/40 p-2">
                <p className="text-xs font-semibold text-slate-300 mb-1">
                  Recoverable amount — proportional haircut (estimate)
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-slate-500">
                      <tr>
                        <th className="text-left py-0.5 pr-3">Hop</th>
                        <th className="text-left py-0.5 pr-3">From → To</th>
                        <th className="text-right py-0.5 pr-3">Edge</th>
                        <th className="text-right py-0.5 pr-3">Total out</th>
                        <th className="text-right py-0.5 pr-3">Share</th>
                        <th className="text-right py-0.5">Running est.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {c.hopSteps.map((s) => (
                        <tr key={s.hopNum}>
                          <td className="py-0.5 pr-3 text-slate-400">{s.hopNum}</td>
                          <td className="py-0.5 pr-3 text-slate-300 font-mono">{s.fromLabel} → {s.toLabel}</td>
                          <td className="py-0.5 pr-3 text-right text-slate-300 font-mono">
                            {s.edgeAmount.toLocaleString()}
                          </td>
                          <td className="py-0.5 pr-3 text-right text-slate-400 font-mono">
                            {s.totalOutgoing.toLocaleString()}
                          </td>
                          <td className="py-0.5 pr-3 text-right text-slate-300 font-mono">
                            {(s.share * 100).toFixed(1)}%
                          </td>
                          <td className="py-0.5 text-right text-cyan-400 font-mono font-semibold">
                            {formatAmount(s.runningAmount, s.token)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-amber-300 mt-1">
                  This is an estimate. Starting amount: {formatAmount(totalSuspectOut, c.recoverableToken)} (total outflow from suspect).
                </p>
              </div>
            )}

            {/* Feedback buttons */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500">Investigator feedback:</span>
              <button
                onClick={() => onFeedback(c.vaspName, 'confirmed')}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  feedback[c.vaspName] === 'confirmed'
                    ? 'bg-emerald-600 border-emerald-500 text-white'
                    : 'border-slate-600 text-slate-300 hover:border-emerald-600'
                }`}
              >
                Confirmed customer
              </button>
              <button
                onClick={() => onFeedback(c.vaspName, 'not_customer')}
                className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                  feedback[c.vaspName] === 'not_customer'
                    ? 'bg-red-600 border-red-500 text-white'
                    : 'border-slate-600 text-slate-300 hover:border-red-600'
                }`}
              >
                Not our customer
              </button>
              {feedback[c.vaspName] && (
                <span className="text-xs text-slate-500">— stored & added to labels</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {traceResult.mixerBreak && (
        <div className="rounded-lg border border-red-800/40 bg-red-950/20 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-red-300">ATTRIBUTION BREAK — Mixer on path</h3>
          <p className="text-xs text-slate-300">Mixer at {shortAddr(traceResult.mixerBreak.mixerAddress)}.</p>
          <p className="text-xs text-amber-300 font-medium">Candidate continuations — LEAD, NOT PROOF:</p>
          <ul className="text-xs text-slate-400 space-y-0.5">
            {traceResult.mixerBreak.candidates.map((c, i) => (
              <li key={i}>{formatAmount(c.amount, 'ETH')} → {shortAddr(c.toAddress)} at {c.time}</li>
            ))}
          </ul>
        </div>
      )}

      {traceResult.issuerPath && (
        <div className="rounded-lg border border-emerald-800/40 bg-emerald-950/20 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-emerald-300">Stablecoin Issuer Path</h3>
          <p className="text-xs text-slate-300">
            Funds rest in wallet {shortAddr(traceResult.issuerPath.address)} holding {traceResult.issuerPath.asset}.
            Possible target: <span className="font-medium text-emerald-300">{traceResult.issuerPath.issuerName}</span> (issuer).
          </p>
          <p className="text-xs text-amber-300">{traceResult.issuerPath.note}</p>
          <p className="text-xs text-slate-500">Confidence: {(traceResult.issuerPath.confidence * 100).toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-700 bg-slate-800/40 px-2 py-1.5">
      <div className="text-slate-500 text-xs">{label}</div>
      <div className="font-mono text-slate-200 text-xs">{value}</div>
    </div>
  );
}
