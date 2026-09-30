export type Chain = 'ethereum' | 'tron' | 'bitcoin';

export type NodeType = 'suspect' | 'unknown' | 'vasp' | 'bridge' | 'mixer' | 'issuer';

export type EvidenceSourceType =
  | 'provider_label'
  | 'curated_public_label'
  | 'behaviour'
  | 'bridge'
  | 'mixer'
  | 'issuer';

export interface LabelEntry {
  address: string;
  entity: string;
  type: 'vasp' | 'bridge' | 'mixer' | 'issuer' | 'unknown';
  source: 'provider' | 'curated' | 'public' | 'feedback';
  confidence?: number;
}

export interface Transfer {
  from: string;
  to: string;
  amount: number;
  token: string;
  timestamp: string;
  txHash: string;
}

export interface GraphNode {
  id: string;
  address: string;
  type: NodeType;
  label?: string;
  entity?: string;
  chain: Chain;
  // behavioural flag
  depositPattern?: {
    contributorAddresses: string[];
    windowHours: number;
    firstSeen: string;
    lastSeen: string;
  };
  // for issuers
  stablecoinAsset?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  amount: number;
  token: string;
  timestamp: string;
  txHash: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface EvidenceItem {
  source: EvidenceSourceType;
  sourceLabel: string;
  hopDistance: number;
  contribution: number;
  detail: string;
}

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

export interface VaspCandidate {
  vaspName: string;
  address: string;
  chain: Chain;
  confidence: number;
  hopDistance: number;
  evidence: EvidenceItem[];
  recoverableAmount: number;
  recoverableToken: string;
  hopSteps: HopStep[];
  freezeUrgency: number;
  freezeBreakdown: { label: string; value: number }[];
  pathNodeIds: string[];
}

export interface TraceResult {
  candidates: VaspCandidate[];
  mixerBreak?: {
    mixerAddress: string;
    candidates: { amount: number; time: string; toAddress: string }[];
  };
  issuerPath?: {
    issuerName: string;
    address: string;
    asset: string;
    note: string;
    confidence: number;
  };
  counters: { hopsUsed: number; apiCallsUsed: number };
}

export type EventType =
  | 'case_created'
  | 'trace_run'
  | 'result'
  | 'request_generated'
  | 'feedback';

export interface LedgerRecord {
  index: number;
  timestamp: string;
  caseId: string;
  eventType: EventType;
  payloadHash: string;
  prevHash: string;
  hash: string;
  payloadPreview: string;
}

export type DataMode = 'demo' | 'live' | 'none';

export interface CaseState {
  caseId: string;
  complaintText: string;
  chain: Chain | null;
  suspectAddress: string | null;
  txHashes: string[];
  extractedAddresses: string[];
  dataMode: DataMode;
  graph: Graph | null;
  traceResult: TraceResult | null;
  feedback: Record<string, 'confirmed' | 'not_customer'>;
  createdAt: string;
}
