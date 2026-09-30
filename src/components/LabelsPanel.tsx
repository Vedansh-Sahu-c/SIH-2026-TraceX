import { useRef } from 'react';
import type { LabelEntry } from '../types';

interface Props {
  labels: LabelEntry[];
  onImport: (entries: LabelEntry[]) => void;
  onAdd: (entry: LabelEntry) => void;
  onClear: () => void;
}

export default function LabelsPanel({ labels, onImport, onAdd, onClear }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  function parseCsv(text: string): LabelEntry[] {
    const lines = text.trim().split('\n');
    if (lines.length === 0) return [];
    // skip header if it looks like a header
    const startIdx = lines[0].toLowerCase().includes('address') ? 1 : 0;
    const entries: LabelEntry[] = [];
    for (let i = startIdx; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      if (parts.length < 2) continue;
      const [address, entity, type, source] = parts;
      entries.push({
        address,
        entity,
        type: (type as LabelEntry['type']) || 'unknown',
        source: (source as LabelEntry['source']) || 'public',
      });
    }
    return entries;
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const entries = parseCsv(text);
      onImport(entries);
    });
  }

  function handleAddRow() {
    onAdd({ address: '', entity: '', type: 'unknown', source: 'public' });
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Labels Panel</h3>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="text-xs rounded border border-slate-600 text-slate-300 hover:bg-slate-800 px-2.5 py-1 transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={handleAddRow}
            className="text-xs rounded border border-slate-600 text-slate-300 hover:bg-slate-800 px-2.5 py-1 transition-colors"
          >
            Add Row
          </button>
          {labels.length > 0 && (
            <button
              onClick={onClear}
              className="text-xs rounded border border-slate-600 text-slate-300 hover:bg-slate-800 px-2.5 py-1 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-500">
        Import publicly sourced known exchange / bridge / mixer / issuer addresses. CSV format: address,entity,type,source
      </p>

      {labels.length === 0 ? (
        <p className="text-xs text-slate-500 italic">No labels. Add publicly sourced labels to improve attribution.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-slate-400">
              <tr>
                <th className="px-2 py-1 text-left">Address</th>
                <th className="px-2 py-1 text-left">Entity</th>
                <th className="px-2 py-1 text-left">Type</th>
                <th className="px-2 py-1 text-left">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {labels.map((l, i) => (
                <tr key={i} className="hover:bg-slate-800/30">
                  <td className="px-2 py-1 font-mono text-slate-300">{l.address || '(empty)'}</td>
                  <td className="px-2 py-1 text-slate-300">{l.entity || '(empty)'}</td>
                  <td className="px-2 py-1 text-slate-400">{l.type}</td>
                  <td className="px-2 py-1 text-slate-400">{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
