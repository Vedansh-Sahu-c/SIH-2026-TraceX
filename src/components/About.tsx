const features: { name: string; status: 'Working' | 'Partial' | 'Planned'; detail: string }[] = [
  { name: 'Case intake & address extraction', status: 'Working', detail: 'Regex-based extraction for Ethereum, Tron, and Bitcoin address formats.' },
  { name: 'Demo case data (2 cases)', status: 'Working', detail: 'Tron USDT and Ethereum cached transaction graphs with fake entities.' },
  { name: 'Fund-flow graph (React Flow)', status: 'Working', detail: 'Interactive graph with color-coded node types.' },
  { name: 'Best-first nearest-VASP search', status: 'Working', detail: 'Value-share ordered expansion with hop and API-call budgets.' },
  { name: 'Confidence formula (noisy-OR)', status: 'Working', detail: 'Provider/curated/behaviour base × hop decay, noisy-OR combination, capped at 0.95.' },
  { name: 'Evidence panel', status: 'Working', detail: 'Labels, behavioural deposit pattern, bridge/mixer detection.' },
  { name: 'Top-3 VASP candidates', status: 'Working', detail: 'Ranked by confidence with evidence lists and freeze urgency.' },
  { name: 'Recoverable amount (haircut)', status: 'Working', detail: 'Proportional estimate across fund-flow hops.' },
  { name: 'Freeze urgency score', status: 'Working', detail: 'Weighted score from amount, recency, and confidence.' },
  { name: 'Investigator feedback', status: 'Working', detail: 'Confirmed / Not-our-customer buttons stored to labels.' },
  { name: 'Request package (copy + mock send)', status: 'Working', detail: 'Pre-filled disclosure/freeze request with SAHYOG mock send.' },
  { name: 'Hash-chained audit ledger', status: 'Working', detail: 'SHA-256 chain via crypto.subtle, verify + tamper simulation.' },
  { name: 'Labels CSV import', status: 'Working', detail: 'Import publicly sourced labels; seeded empty.' },
  { name: 'Live TronGrid API (Tron)', status: 'Partial', detail: 'Fetches live TRC20 USDT transfers. Rate limits and CORS may apply.' },
  { name: 'Live Ethereum API', status: 'Planned', detail: 'Listed in chain selector but disabled.' },
  { name: 'Live Bitcoin API', status: 'Planned', detail: 'Listed in chain selector but disabled.' },
  { name: 'PDF export of request', status: 'Planned', detail: 'Not implemented; copy-to-clipboard only.' },
  { name: 'Real VASP address database', status: 'Planned', detail: 'Use the Labels panel to add publicly sourced labels.' },
];

const statusColors: Record<string, string> = {
  Working: 'text-emerald-400 bg-emerald-950/30 border-emerald-800/40',
  Partial: 'text-amber-400 bg-amber-950/30 border-amber-800/40',
  Planned: 'text-slate-400 bg-slate-800/40 border-slate-700',
};

export default function About() {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h2 className="text-xl font-semibold text-slate-100">About TraceX</h2>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-2 text-sm text-slate-300">
        <p>
          TraceX is a prototype investigation tool for SIH26182: attributing unknown crypto wallets
          to the nearest VASP (Virtual Asset Service Provider) so a lawful request can be served
          while funds can still be frozen.
        </p>
        <p className="text-xs text-slate-400">
          A wallet owner cannot be identified from the chain alone. TraceX finds the right VASP fast,
          so a lawful request can be served while funds can still be frozen.
        </p>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-800/60 text-slate-400">
            <tr>
              <th className="px-4 py-2 text-left">Feature</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {features.map((f) => (
              <tr key={f.name} className="hover:bg-slate-800/30">
                <td className="px-4 py-2.5 text-slate-200">{f.name}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded border ${statusColors[f.status]}`}>
                    {f.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-400">{f.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 text-xs text-slate-400">
        <p className="font-medium text-slate-300 mb-1">Privacy</p>
        <p>Only wallet addresses are ever sent to external APIs (TronGrid, in live mode). No personal data is transmitted.</p>
      </div>
    </div>
  );
}
