import { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
  Position,
} from 'reactflow';
import dagre from 'dagre';
import type { Graph, GraphNode, TraceResult, DataMode } from '../types';
import { shortAddr, formatAmount } from '../engine';
import { DemoBadge, LiveBadge } from './Intake';

interface Props {
  graph: Graph;
  traceResult: TraceResult | null;
  dataMode: DataMode;
  hopBudget: number;
  apiCallBudget: number;
  hopsUsed: number;
  apiCallsUsed: number;
  onRunTrace: () => void;
  onNodeClick: (node: GraphNode | null) => void;
  selectedNode: GraphNode | null;
  tracing: boolean;
}

export const nodeColors: Record<string, string> = {
  suspect: '#ef4444',
  unknown: '#64748b',
  vasp: '#06b6d4',
  bridge: '#8b5cf6',
  mixer: '#f59e0b',
  issuer: '#10b981',
};

const NODE_W = 190;
const NODE_H = 72;

function buildDagreLayout(
  graph: Graph
): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 120, marginx: 40, marginy: 40 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const node of graph.nodes) {
    g.setNode(node.id, { width: NODE_W, height: NODE_H });
  }
  for (const edge of graph.edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of graph.nodes) {
    const n = g.node(node.id);
    positions.set(node.id, { x: n.x - NODE_W / 2, y: n.y - NODE_H / 2 });
  }
  return positions;
}

function toFlowNodes(
  graph: Graph,
  highlightPath: string[] | undefined,
  positions: Map<string, { x: number; y: number }>
): Node[] {
  const inPath = new Set(highlightPath || []);
  return graph.nodes.map((n) => {
    const pos = positions.get(n.id) || { x: 0, y: 0 };
    const color = nodeColors[n.type] || '#64748b';
    return {
      id: n.id,
      position: pos,
      data: {
        label: (
          <div className="text-center leading-tight">
            <div className="text-xs font-semibold text-slate-100 truncate">
              {n.label || n.entity || shortAddr(n.address)}
            </div>
            <div className="text-[10px] text-slate-400 font-mono">{shortAddr(n.address)}</div>
            <div
              className="text-[10px] mt-0.5 font-medium uppercase tracking-wide"
              style={{ color }}
            >
              {n.type}
            </div>
          </div>
        ),
      },
      style: {
        background: inPath.has(n.id) ? '#0c2340' : '#1e293b',
        border: `2px solid ${inPath.has(n.id) ? '#06b6d4' : color}`,
        borderRadius: '8px',
        padding: '6px 8px',
        width: NODE_W,
        height: NODE_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}

function toFlowEdges(graph: Graph, highlightPath: string[] | undefined): Edge[] {
  const pathSet = new Set<string>();
  if (highlightPath && highlightPath.length > 1) {
    for (let i = 0; i < highlightPath.length - 1; i++) {
      pathSet.add(`${highlightPath[i]}->${highlightPath[i + 1]}`);
    }
  }

  return graph.edges.map((e) => {
    const onPath = pathSet.has(`${e.source}->${e.target}`);
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      label: formatAmount(e.amount, e.token),
      labelStyle: {
        fontSize: 10,
        fill: onPath ? '#06b6d4' : '#94a3b8',
        fontWeight: onPath ? 700 : 400,
      },
      labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
      labelBgPadding: [3, 4] as [number, number],
      style: {
        stroke: onPath ? '#06b6d4' : '#475569',
        strokeWidth: onPath ? 2.5 : 1.5,
      },
      animated: onPath,
      type: 'smoothstep',
    };
  });
}

export default function TraceView({
  graph,
  traceResult,
  dataMode,
  hopBudget,
  apiCallBudget,
  hopsUsed,
  apiCallsUsed,
  onRunTrace,
  onNodeClick,
  selectedNode,
  tracing,
}: Props) {
  const handleNodeClick = useCallback<NodeMouseHandler>(
    (_evt, node) => {
      const gNode = graph.nodes.find((n) => n.id === node.id) || null;
      onNodeClick(gNode);
    },
    [graph, onNodeClick]
  );

  const positions = useMemo(() => buildDagreLayout(graph), [graph]);
  const bestPath = traceResult?.candidates[0]?.pathNodeIds;
  const flowNodes = useMemo(() => toFlowNodes(graph, bestPath, positions), [graph, bestPath, positions]);
  const flowEdges = useMemo(() => toFlowEdges(graph, bestPath), [graph, bestPath]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-slate-100">Fund Flow Trace</h2>
        {dataMode === 'demo' && <DemoBadge />}
        {dataMode === 'live' && <LiveBadge />}
        <div className="ml-auto flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Hops:</span>
            <span className="font-mono text-cyan-400">{hopsUsed}/{hopBudget}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">API calls:</span>
            <span className="font-mono text-cyan-400">{apiCallsUsed}/{apiCallBudget}</span>
          </div>
          <button
            onClick={onRunTrace}
            disabled={tracing}
            className="rounded-md bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 px-3 py-1.5 text-xs font-medium text-white transition-colors"
          >
            {tracing ? 'Tracing...' : 'Run Trace'}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3" style={{ height: '70vh' }}>
        <div className="flex-1 rounded-lg border border-slate-700 bg-slate-900/60 overflow-hidden">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#334155" gap={16} />
            <Controls />
          </ReactFlow>
        </div>

        <div className="w-full lg:w-96 rounded-lg border border-slate-700 bg-slate-900/60 p-4 overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-200 mb-3">Evidence Panel</h3>
          {!selectedNode ? (
            <p className="text-xs text-slate-500">Click a node to view its evidence.</p>
          ) : (
            <NodeEvidence node={selectedNode} traceResult={traceResult} />
          )}

          <div className="mt-6 pt-4 border-t border-slate-700">
            <p className="text-xs font-semibold text-slate-300 mb-2">Node Legend</p>
            <div className="grid grid-cols-2 gap-1.5">
              {Object.entries(nodeColors).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: color }} />
                  <span className="capitalize">{type}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">Highlighted path = best candidate route.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function NodeEvidence({
  node,
  traceResult,
}: {
  node: GraphNode;
  traceResult: TraceResult | null;
}) {
  const candidate = traceResult?.candidates.find((c) => c.address === node.address);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-slate-400">Address</p>
        <p className="text-xs font-mono text-slate-200 break-all">{node.address}</p>
      </div>
      <div>
        <p className="text-xs text-slate-400">Type</p>
        <p className="text-xs capitalize font-medium" style={{ color: nodeColors[node.type] }}>{node.type}</p>
      </div>
      {node.entity && (
        <div>
          <p className="text-xs text-slate-400">Entity</p>
          <p className="text-xs text-slate-200">{node.entity}</p>
        </div>
      )}
      {node.depositPattern && (
        <div className="rounded-md border border-amber-800/40 bg-amber-950/20 p-2 space-y-1">
          <p className="text-xs font-semibold text-amber-300">Exchange Deposit Pattern</p>
          <p className="text-xs text-slate-300">
            {node.depositPattern.contributorAddresses.length} distinct fresh addresses each sent once to this
            collector within {node.depositPattern.windowHours}h.
          </p>
          <p className="text-xs text-slate-400">Window: {node.depositPattern.firstSeen} → {node.depositPattern.lastSeen}</p>
          <ul className="text-xs font-mono text-slate-500 space-y-0.5 mt-1">
            {node.depositPattern.contributorAddresses.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {candidate && (
        <div className="space-y-2">
          <div className="rounded-md border border-cyan-800/40 bg-cyan-950/20 p-2">
            <p className="text-xs font-semibold text-cyan-300">VASP Candidate: {candidate.vaspName}</p>
            <p className="text-xs text-slate-300">Confidence: <span className="font-mono text-cyan-400">{(candidate.confidence * 100).toFixed(0)}%</span></p>
            <p className="text-xs text-slate-300">Hop distance: {candidate.hopDistance}</p>
            <p className="text-xs text-slate-300">Recoverable: {formatAmount(candidate.recoverableAmount, candidate.recoverableToken)} (estimate)</p>
            <p className="text-xs text-slate-300">Freeze urgency: {candidate.freezeUrgency}/100</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-300 mb-1">Evidence</p>
            <ul className="space-y-1.5">
              {candidate.evidence.map((ev, i) => (
                <li key={i} className="rounded border border-slate-700 bg-slate-800/50 p-2 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-200">{ev.sourceLabel}</span>
                    <span className="text-slate-400">hop {ev.hopDistance}</span>
                  </div>
                  <p className="text-slate-400 mt-0.5">{ev.detail}</p>
                  <p className="text-slate-500 mt-0.5">Contribution: {(ev.contribution * 100).toFixed(0)}%</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {node.type === 'mixer' && traceResult?.mixerBreak && (
        <div className="rounded-md border border-red-800/40 bg-red-950/20 p-2 space-y-1">
          <p className="text-xs font-semibold text-red-300">ATTRIBUTION BREAK</p>
          <p className="text-xs text-slate-300">Funds entered a mixer. Continuations below are labelled LEAD, NOT PROOF.</p>
          <ul className="text-xs text-slate-400 space-y-0.5">
            {traceResult.mixerBreak.candidates.map((c, i) => (
              <li key={i}>{formatAmount(c.amount, 'ETH')} → {shortAddr(c.toAddress)} at {c.time}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
