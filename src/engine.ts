import type {
  Chain,
  Graph,
  GraphNode,
  GraphEdge,
  VaspCandidate,
  EvidenceItem,
  TraceResult,
  LabelEntry,
} from './types';
import { KNOWN_BRIDGES, KNOWN_MIXERS } from './demoData';

// ---------- Address / chain detection ----------

export function detectChain(address: string): Chain | null {
  const a = address.trim();
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return 'ethereum';
  if (/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return 'tron';
  if (/^(bc1[ac-hj-np-z02-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39})$/.test(a)) return 'bitcoin';
  return null;
}

export function extractAddresses(text: string): string[] {
  const eth = text.match(/0x[0-9a-fA-F]{40}/g) || [];
  const tron = text.match(/T[1-9A-HJ-NP-Za-km-z]{33}/g) || [];
  const btc = text.match(/bc1[ac-hj-np-z02-9]{6,87}|[13][a-km-zA-HJ-NP-Z1-9]{25,39}/g) || [];
  return [...new Set([...eth, ...tron, ...btc])];
}

export function extractTxHashes(text: string): string[] {
  const eth = text.match(/0x[0-9a-fA-F]{64}/g) || [];
  const tron = text.match(/\b[0-9a-fA-F]{64}\b/g) || [];
  return [...new Set([...eth, ...tron])];
}

// ---------- Confidence ----------

const BASE_CONFIDENCE: Record<string, number> = {
  provider_label: 0.9,
  curated_public_label: 0.8,
  behaviour: 0.6,
};

const HOP_DECAY = 0.85;
const CAP = 0.95;

export function confidenceFromSource(source: string, hopDistance: number): number {
  const base = BASE_CONFIDENCE[source] ?? 0.5;
  return Math.min(CAP, base * Math.pow(HOP_DECAY, hopDistance));
}

export function noisyOR(probabilities: number[]): number {
  let product = 1;
  for (const p of probabilities) product *= 1 - p;
  return Math.min(CAP, 1 - product);
}

// ---------- Graph helpers ----------

export function outgoingEdges(graph: Graph, nodeId: string): GraphEdge[] {
  return graph.edges
    .filter((e) => e.source === nodeId)
    .sort((a, b) => b.amount - a.amount);
}

export function findNode(graph: Graph, nodeId: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.id === nodeId);
}

export function nodeByAddress(graph: Graph, address: string): GraphNode | undefined {
  return graph.nodes.find((n) => n.address.toLowerCase() === address.toLowerCase());
}

// ---------- Label matching ----------

export function matchLabels(
  node: GraphNode,
  labels: LabelEntry[]
): { source: 'provider_label' | 'curated_public_label' | 'feedback'; label: LabelEntry | null } {
  const match = labels.find(
    (l) => l.address.toLowerCase() === node.address.toLowerCase()
  );
  if (match) {
    if (match.source === 'provider') return { source: 'provider_label', label: match };
    if (match.source === 'curated' || match.source === 'public')
      return { source: 'curated_public_label', label: match };
    if (match.source === 'feedback')
      return { source: 'feedback', label: match };
  }
  return { source: 'curated_public_label', label: null };
}

// ---------- Best-first search ----------

export interface SearchCallbacks {
  onCounters: (hops: number, apiCalls: number) => void;
  hopBudget: number;
  apiCallBudget: number;
  labels: LabelEntry[];
}

interface FrontierItem {
  nodeId: string;
  hopDistance: number;
  pathFromSuspect: string[];
  amountRemaining: number;
  apiCalls: number;
}

export function runTrace(
  graph: Graph,
  suspectNodeId: string,
  cb: SearchCallbacks
): TraceResult {
  const suspect = findNode(graph, suspectNodeId);
  if (!suspect) {
    return { candidates: [], counters: { hopsUsed: 0, apiCallsUsed: 0 } };
  }

  const visited = new Set<string>([suspectNodeId]);
  // amountRemaining on the suspect node = total outgoing (will be used as the base)
  const suspectOutgoing = outgoingEdges(graph, suspectNodeId);
  const totalOut = suspectOutgoing.reduce((s, e) => s + e.amount, 0) || 1;

  const frontier: FrontierItem[] = [
    { nodeId: suspectNodeId, hopDistance: 0, pathFromSuspect: [suspectNodeId], amountRemaining: totalOut, apiCalls: 0 },
  ];

  const candidates: VaspCandidate[] = [];
  let mixerBreak: TraceResult['mixerBreak'] | undefined;
  let issuerPath: TraceResult['issuerPath'] | undefined;
  let hopsUsed = 0;
  let apiCallsUsed = 0;

  while (frontier.length > 0) {
    frontier.sort((a, b) => b.amountRemaining - a.amountRemaining);
    const item = frontier.shift()!;
    if (item.hopDistance > cb.hopBudget) break;
    if (item.apiCalls > cb.apiCallBudget) break;

    hopsUsed = Math.max(hopsUsed, item.hopDistance);
    apiCallsUsed = item.apiCalls;

    const node = findNode(graph, item.nodeId)!;
    cb.onCounters(hopsUsed, apiCallsUsed);

    const labelMatch = matchLabels(node, cb.labels);

    let isVasp = node.type === 'vasp';
    let vaspName = node.entity || node.label || '';
    if (labelMatch.label && (labelMatch.label.type === 'vasp' || labelMatch.label.type === 'issuer')) {
      isVasp = true;
      vaspName = vaspName || labelMatch.label.entity;
    }

    const isMixer = node.type === 'mixer' || labelMatch.label?.type === 'mixer' ||
      KNOWN_MIXERS.some((m) => m.address.toLowerCase() === node.address.toLowerCase());
    if (isMixer && !mixerBreak) {
      const outEdges = outgoingEdges(graph, node.id);
      mixerBreak = {
        mixerAddress: node.address,
        candidates: outEdges.map((e) => ({
          amount: e.amount,
          time: e.timestamp,
          toAddress: findNode(graph, e.target)?.address || e.target,
        })),
      };
    }

    const isBridge = node.type === 'bridge' || labelMatch.label?.type === 'bridge' ||
      KNOWN_BRIDGES.some((b) => b.address.toLowerCase() === node.address.toLowerCase());

    if (!isVasp && !isMixer && !isBridge) {
      const outEdges = outgoingEdges(graph, node.id);
      if (outEdges.length === 0) {
        const incomingEdges = graph.edges.filter((e) => e.target === node.id);
        const token = incomingEdges[0]?.token || '';
        if (['USDT', 'USDC', 'DAI', 'BUSD'].includes(token.toUpperCase())) {
          const issuerName = token.toUpperCase() === 'USDT' ? 'Tether' :
            token.toUpperCase() === 'USDC' ? 'Circle' :
            token.toUpperCase() === 'DAI' ? 'MakerDAO' : 'Binance';
          issuerPath = {
            issuerName,
            address: node.address,
            asset: token,
            note: 'verify the issuer\'s law-enforcement process',
            confidence: 0.6 * Math.pow(HOP_DECAY, item.hopDistance),
          };
        }
      }
    }

    if (isVasp && vaspName) {
      const evidence: EvidenceItem[] = [];
      const confidences: number[] = [];

      if (labelMatch.label) {
        if (labelMatch.source === 'provider_label') {
          const conf = confidenceFromSource('provider_label', item.hopDistance);
          confidences.push(conf);
          evidence.push({
            source: 'provider_label',
            sourceLabel: 'Provider label',
            hopDistance: item.hopDistance,
            contribution: conf,
            detail: `Address ${shortAddr(node.address)} labelled as ${vaspName} by provider.`,
          });
        } else if (labelMatch.source === 'curated_public_label') {
          const conf = confidenceFromSource('curated_public_label', item.hopDistance);
          confidences.push(conf);
          evidence.push({
            source: 'curated_public_label',
            sourceLabel: 'Curated public label',
            hopDistance: item.hopDistance,
            contribution: conf,
            detail: `Address ${shortAddr(node.address)} labelled as ${vaspName} from curated public source.`,
          });
        }
      }

      if (node.depositPattern) {
        const conf = confidenceFromSource('behaviour', item.hopDistance);
        confidences.push(conf);
        const timings = node.depositPattern.contributorAddresses
          .map((a, i) => `${shortAddr(a)} (${node.depositPattern!.firstSeen.slice(0, 16)})`)
          .slice(0, 6)
          .join(', ');
        evidence.push({
          source: 'behaviour',
          sourceLabel: 'Exchange deposit pattern',
          hopDistance: item.hopDistance,
          contribution: conf,
          detail: `${node.depositPattern.contributorAddresses.length} distinct fresh addresses each sent once to collector ${shortAddr(node.address)} within ${node.depositPattern.windowHours}h. Addresses and timings: ${timings}. Window: ${node.depositPattern.firstSeen} → ${node.depositPattern.lastSeen}.`,
        });
      }

      if (node.type === 'vasp' && evidence.length === 0) {
        const conf = confidenceFromSource('curated_public_label', item.hopDistance);
        confidences.push(conf);
        evidence.push({
          source: 'curated_public_label',
          sourceLabel: 'Curated public label',
          hopDistance: item.hopDistance,
          contribution: conf,
          detail: `Address ${shortAddr(node.address)} attributed to ${vaspName} from graph label.`,
        });
      }

      const confidence = confidences.length > 0 ? noisyOR(confidences) : 0.3;

      // Correct proportional haircut: walk the path, at each hop divide by total outgoing of that node
      const { amount, hopSteps } = computeRecoverable(graph, item.pathFromSuspect, totalOut);
      const recoverableToken = suspectOutgoing[0]?.token || 'UNKNOWN';

      const freezeUrgency = computeFreezeUrgency(amount, confidence, node, graph);

      candidates.push({
        vaspName,
        address: node.address,
        chain: node.chain,
        confidence,
        hopDistance: item.hopDistance,
        evidence,
        recoverableAmount: amount,
        recoverableToken,
        hopSteps,
        freezeUrgency: freezeUrgency.score,
        freezeBreakdown: freezeUrgency.breakdown,
        pathNodeIds: item.pathFromSuspect,
      });
    }

    if (!isVasp) {
      const outEdges = outgoingEdges(graph, item.nodeId);
      const totalOutgoing = outEdges.reduce((s, e) => s + e.amount, 0) || 1;
      for (const edge of outEdges) {
        if (visited.has(edge.target)) continue;
        visited.add(edge.target);
        // child gets its proportional share of what arrived at this node
        const share = edge.amount / totalOutgoing;
        frontier.push({
          nodeId: edge.target,
          hopDistance: item.hopDistance + 1,
          pathFromSuspect: [...item.pathFromSuspect, edge.target],
          amountRemaining: item.amountRemaining * share,
          apiCalls: item.apiCalls + 1,
        });
      }
    }

    if (candidates.length > 0 && Math.max(...candidates.map((c) => c.confidence)) >= 0.8) {
      break;
    }
  }

  // Rank: confidence desc, then hop distance asc, then recoverable amount desc
  candidates.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      a.hopDistance - b.hopDistance ||
      b.recoverableAmount - a.recoverableAmount
  );
  const top3 = candidates.slice(0, 3);

  return {
    candidates: top3,
    mixerBreak,
    issuerPath,
    counters: { hopsUsed, apiCallsUsed },
  };
}

// ---------- Recoverable amount (correct proportional haircut) ----------

export interface HopStep {
  hopNum: number;
  fromLabel: string;
  toLabel: string;
  edgeAmount: number;
  totalOutgoing: number;
  share: number;
  runningAmount: number;
  token: string;
}

export function computeRecoverable(
  graph: Graph,
  pathNodeIds: string[],
  totalOutFromSuspect: number
): { amount: number; hopSteps: HopStep[] } {
  if (pathNodeIds.length < 2) return { amount: 0, hopSteps: [] };
  const hopSteps: HopStep[] = [];
  let amount = totalOutFromSuspect;
  const token = graph.edges[0]?.token || 'UNKNOWN';

  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const fromId = pathNodeIds[i];
    const toId = pathNodeIds[i + 1];
    const fromNode = findNode(graph, fromId)!;
    const toNode = findNode(graph, toId)!;
    const edges = outgoingEdges(graph, fromId);
    const totalFromNode = edges.reduce((s, e) => s + e.amount, 0) || 1;
    const edgeToChild = edges.find((e) => e.target === toId);
    if (!edgeToChild) {
      amount = 0;
      break;
    }
    const share = edgeToChild.amount / totalFromNode;
    amount = amount * share;
    hopSteps.push({
      hopNum: i + 1,
      fromLabel: fromNode.label || fromNode.entity || shortAddr(fromNode.address),
      toLabel: toNode.label || toNode.entity || shortAddr(toNode.address),
      edgeAmount: edgeToChild.amount,
      totalOutgoing: totalFromNode,
      share,
      runningAmount: amount,
      token,
    });
  }

  return { amount, hopSteps };
}

// ---------- Freeze urgency ----------

function computeFreezeUrgency(
  recoverableAmount: number,
  confidence: number,
  node: GraphNode,
  graph: Graph
): { score: number; breakdown: { label: string; value: number }[] } {
  const incoming = graph.edges.filter((e) => e.target === node.id);
  const lastIncoming = incoming.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
  let recencyScore = 0.5;
  if (lastIncoming) {
    const ageHours = (Date.now() - new Date(lastIncoming.timestamp).getTime()) / (1000 * 60 * 60);
    recencyScore = Math.max(0.05, Math.min(1, 24 / Math.max(1, ageHours) * 0.5));
  }

  const amountScore = Math.min(1, recoverableAmount / 10000);
  const score = Math.round((amountScore * 0.4 + recencyScore * 0.3 + confidence * 0.3) * 100);

  return {
    score,
    breakdown: [
      { label: 'Recoverable amount score', value: Math.round(amountScore * 100) },
      { label: 'Recency at VASP score', value: Math.round(recencyScore * 100) },
      { label: 'Confidence score', value: Math.round(confidence * 100) },
    ],
  };
}

// ---------- Utils ----------

export function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

export function formatAmount(amount: number, token: string): string {
  if (token === 'ETH' || token === 'BTC') {
    return `${amount.toFixed(4)} ${token}`;
  }
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${token}`;
}
