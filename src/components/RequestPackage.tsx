import { useState } from 'react';
import type { CaseState, TraceResult, DataMode } from '../types';
import { formatAmount, shortAddr } from '../engine';
import { DemoBadge, LiveBadge } from './Intake';

interface Props {
  caseState: CaseState;
  traceResult: TraceResult;
  dataMode: DataMode;
  onGenerated: () => void;
}

function priorityFromUrgency(score: number): string {
  if (score >= 60) return 'HIGH';
  if (score >= 30) return 'MEDIUM';
  return 'ROUTINE';
}

export default function RequestPackage({ caseState, traceResult, dataMode, onGenerated }: Props) {
  const top = traceResult.candidates[0];
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!top) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-slate-100">Request Package</h2>
        </div>
        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-6 text-center text-sm text-slate-400">
          No VASP candidate available. Run a trace first.
        </div>
      </div>
    );
  }

  const priority = priorityFromUrgency(top.freezeUrgency);

  // Subject wallets: suspect address (source) + deposit address at VASP (destination only)
  const depositAddress = top.address;

  // Fund path from hop steps
  const fundPathLines = top.hopSteps.map(
    (s) =>
      `   Hop ${s.hopNum}: ${s.fromLabel} → ${s.toLabel}  |  ${formatAmount(s.edgeAmount, s.token)} of ${formatAmount(s.totalOutgoing, s.token)} (${(s.share * 100).toFixed(1)}%)  |  Tx: ${
        caseState.graph?.edges.find(
          (e) =>
            e.source ===
              (caseState.graph?.nodes.find((n) => n.label === s.fromLabel || n.entity === s.fromLabel)?.id || '') &&
            e.target ===
              (caseState.graph?.nodes.find((n) => n.label === s.toLabel || n.entity === s.toLabel)?.id || '')
        )?.txHash || '(see transaction hashes above)'
      }`
  );

  // Better: build fund path from path node IDs + edges
  const pathNodeIds = top.pathNodeIds;
  const fundPathRows: string[] = [];
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const fromId = pathNodeIds[i];
    const toId = pathNodeIds[i + 1];
    const fromNode = caseState.graph?.nodes.find((n) => n.id === fromId);
    const toNode = caseState.graph?.nodes.find((n) => n.id === toId);
    const edge = caseState.graph?.edges.find((e) => e.source === fromId && e.target === toId);
    if (!edge || !fromNode || !toNode) continue;
    const fromLabel = fromNode.label || fromNode.entity || shortAddr(fromNode.address);
    const toLabel = toNode.label || toNode.entity || shortAddr(toNode.address);
    fundPathRows.push(
      `   Hop ${i + 1}: ${fromLabel} (${shortAddr(fromNode.address)}) → ${toLabel} (${shortAddr(toNode.address)})` +
      `\n           Amount: ${formatAmount(edge.amount, edge.token)}` +
      `\n           Timestamp: ${edge.timestamp}` +
      `\n           Tx hash: ${edge.txHash}`
    );
  }

  const evidenceSummary = top.evidence
    .map((e) => `   - ${e.sourceLabel} (hop ${e.hopDistance}, contribution ${(e.contribution * 100).toFixed(0)}%): ${e.detail}`)
    .join('\n');

  // Consecutive section numbers, skipping optional sections only if absent
  let secNum = 0;
  const sec = () => { secNum++; return secNum; };

  const mixerSection = traceResult.mixerBreak
    ? `${sec()}. ATTRIBUTION BREAK\n   Mixer detected on path at ${shortAddr(traceResult.mixerBreak.mixerAddress)}.\n   Continuation candidates are LEAD, NOT PROOF.\n`
    : null;

  const issuerSection = traceResult.issuerPath
    ? `${sec()}. STABLECOIN ISSUER PATH\n   Issuer: ${traceResult.issuerPath.issuerName} (${traceResult.issuerPath.asset})\n   Note: ${traceResult.issuerPath.note}\n`
    : null;

  // Build the text with consecutive numbering
  let n = 0;
  const N = () => { n++; return n; };

  const requestText =
`LAWFUL DISCLOSURE AND FREEZE REQUEST (via SAHYOG)
==================================================

Date: ${new Date().toISOString().split('T')[0]}
Case ID: ${caseState.caseId}
Priority: ${priority}
Chain: ${caseState.chain?.toUpperCase() || 'UNKNOWN'}

TO: ${top.vaspName} (Compliance / Legal team)
RE: Disclosure of account holder and preservation of funds

${N()}. SUBJECT WALLETS
   Source (suspect wallet):
      ${caseState.suspectAddress || '(unknown)'}

   Destination (deposit address at ${top.vaspName}):
      ${depositAddress}

${N()}. FUND PATH
${fundPathRows.length > 0 ? fundPathRows.join('\n\n') : '   (no hop details available)'}

${N()}. RELEVANT TRANSACTION HASHES
${caseState.txHashes.length > 0 ? caseState.txHashes.map((h) => `   - ${h}`).join('\n') : '   (see fund path above)'}

${N()}. ESTIMATED RECOVERABLE AMOUNT
   ${formatAmount(top.recoverableAmount, top.recoverableToken)}
   Method: proportional haircut across fund-flow hops (estimate, not guaranteed)
${top.hopSteps.map((s) => `   Hop ${s.hopNum}: ${s.edgeAmount.toLocaleString()} / ${s.totalOutgoing.toLocaleString()} = ${(s.share * 100).toFixed(1)}% → running estimate ${formatAmount(s.runningAmount, s.token)}`).join('\n')}

${N()}. ATTRIBUTION SUMMARY
   Nearest VASP: ${top.vaspName}
   Confidence: ${(top.confidence * 100).toFixed(0)}%
   Hop distance from suspect: ${top.hopDistance}
   Freeze urgency score: ${top.freezeUrgency}/100
   Priority derived from freeze urgency: ${priority}

${N()}. EVIDENCE SUMMARY
${evidenceSummary || '   (none)'}
${mixerSection ? `\n${sec() - (mixerSection ? 1 : 0)}. ${mixerSection}` : ''}${issuerSection ? `\n${issuerSection}` : ''}
${N()}. REQUESTED ACTIONS
   a) Confirm whether the deposit address (${shortAddr(depositAddress)}) is hosted by ${top.vaspName} and identify the associated account as permitted by applicable law.
   b) Preserve all transaction records, KYC documentation, and account information related to the deposit address.
   c) Hold the funds attributed to the deposit address pending a lawful order.

${N()}. LEGAL BASIS
   Legal basis: [to be filled by the investigating officer]

${N()}. NOTES
   This request was generated by TraceX (prototype), a tool that attributes
   unknown crypto wallets to the nearest VASP for law-enforcement purposes.
   Wallet ownership cannot be determined from on-chain data alone.
   Only wallet addresses were used to generate this analysis; no personal data
   was submitted to any external service.

---
Generated by TraceX | Prototype | SIH26182
`;

  function handleCopy() {
    navigator.clipboard.writeText(requestText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleSend() {
    setSent(true);
    onGenerated();
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Request Package</h2>
        {dataMode === 'demo' && <DemoBadge />}
        {dataMode === 'live' && <LiveBadge />}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleCopy}
          className="rounded-md bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          {copied ? 'Copied!' : 'Copy Request Text'}
        </button>
        <button
          onClick={handleSend}
          className="rounded-md bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition-colors"
        >
          Send to SAHYOG (mock)
        </button>
        {sent && (
          <span className="text-xs text-emerald-400">Mock request submitted to SAHYOG portal (simulated).</span>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-950 p-4 overflow-x-auto">
        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">{requestText}</pre>
      </div>
    </div>
  );
}
