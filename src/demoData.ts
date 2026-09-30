import type { Graph, LabelEntry, CaseState } from './types';

// Clearly fake, structurally valid-looking addresses. Not real exchange addresses.
// Tron: T + 33 base58-ish chars. Ethereum: 0x + 40 hex.

export const DEMO_LABELS: LabelEntry[] = [];

export const DEMO_CASE_TRON: CaseState = {
  caseId: 'DEMO-TRON-001',
  complaintText:
    'Complainant reports losing USDT to a wallet starting with T...DEMO-SUSPECT-A. Funds moved through several intermediaries. Please trace and find the nearest VASP for a freeze request. Transaction hash: 0fade1deadbeefdeadbeefdeadbeefdeadbeef1234.',
  chain: 'tron',
  suspectAddress: 'TDEMoSUSPECTaaaa1234567890abcdefghijKLM',
  txHashes: ['0fade1deadbeefdeadbeefdeadbeefdeadbeef1234'],
  extractedAddresses: ['TDEMoSUSPECTaaaa1234567890abcdefghijKLM'],
  dataMode: 'demo',
  createdAt: '2026-01-15T09:00:00Z',
  feedback: {},
  graph: null,
  traceResult: null,
};

export const DEMO_CASE_ETHEREUM: CaseState = {
  caseId: 'DEMO-ETH-002',
  complaintText:
    'ETH wallet 0xdemo0000000000000000000000000000000000Aa received stolen funds, routed through a bridge then deposited to an exchange. Trace to nearest VASP.',
  chain: 'ethereum',
  suspectAddress: '0xdemo0000000000000000000000000000000000Aa',
  txHashes: ['0xeeee000000000000000000000000000000000000000000000000000000000001'],
  extractedAddresses: ['0xdemo0000000000000000000000000000000000Aa'],
  dataMode: 'demo',
  createdAt: '2026-02-20T14:30:00Z',
  feedback: {},
  graph: null,
  traceResult: null,
};

// Tron demo graph:
//  n0 (suspect, 50k out) → n1 (intermediary, 48k) → n2 (collector, 45k) → n3 VASP DEMO-EXCHANGE-1 (38k)
//                                                                          → n4 VASP DEMO-EXCHANGE-2 (7k)
//  n0 → n2 directly (2k, so n0 total out = 50k)
//  n0 → n5 (collector2, behaviour-only, 0k labelled) → n6 VASP DEMO-EXCHANGE-3 (behaviour only, no label)
//     n0 sends 0 to n5 directly — instead n5 is reached by a separate 500 USDT transfer
//
// Amounts from n0: 48000 + 2000 = 50000 total
// Path n0→n1→n2→n3: share hop1 = 48000/50000 = 0.96; hop2 = 45000/45000 = 1.0 (n1 only output); hop3 = 38000/45000 = 0.844
//   recoverable = 50000 × 0.96 × 1.0 × 0.844 ≈ 40,533 USDT
// Path n0→n2→n4: share hop1 = 2000/50000 = 0.04; hop2 = 7000/45000 = 0.156
//   recoverable = 50000 × 0.04 × 0.156 ≈ 311 USDT  (but n2 is visited first via n1, so n2 already visited)
// For DEMO-EXCHANGE-2 path via n0→n1→n2→n4: hop1=0.96, hop2=1.0, hop3=7000/45000=0.156
//   recoverable = 50000 × 0.96 × 1.0 × 0.156 ≈ 7,467 USDT  ✓ correct order of magnitude
//
// DEMO-EXCHANGE-3: reached via n0→n5→n6 (n5 is a collector found by behavioural signal only)
// n0 sends 0 directly to n5 in this demo, instead we model n0→n5 as a small transfer
// to keep the graph simple: n0 → n5 (500 USDT), n5 is a collector with depositPattern, n5 → n6 VASP

export const DEMO_GRAPH_TRON: Graph = {
  nodes: [
    {
      id: 'n0',
      address: 'TDEMoSUSPECTaaaa1234567890abcdefghijKLM',
      type: 'suspect',
      chain: 'tron',
      label: 'DEMO-SUSPECT-A',
    },
    {
      id: 'n1',
      address: 'TDEMoINTERaaaa1234567890abcdefghij123ab',
      type: 'unknown',
      chain: 'tron',
    },
    {
      id: 'n2',
      address: 'TDEMoCOLLECTaaa1234567890abcdefghijXYZ',
      type: 'unknown',
      chain: 'tron',
      depositPattern: {
        contributorAddresses: [
          'TDEMoFRESH001aaaa1234567890aaaaaaaaaaaa',
          'TDEMoFRESH002aaaa1234567890bbbbbbbbbbbb',
          'TDEMoFRESH003aaaa1234567890cccccccccccc',
          'TDEMoFRESH004aaaa1234567890dddddddddddd',
        ],
        windowHours: 3,
        firstSeen: '2026-01-15T09:05:00Z',
        lastSeen: '2026-01-15T12:00:00Z',
      },
    },
    {
      id: 'n3',
      address: 'TDEMoVASP0001aaaa1234567890aaaaaaZZaabb',
      type: 'vasp',
      chain: 'tron',
      entity: 'DEMO-EXCHANGE-1',
      label: 'DEMO-EXCHANGE-1',
    },
    {
      id: 'n4',
      address: 'TDEMoVASP0002aaaa1234567890bbbbbbZZccdd',
      type: 'vasp',
      chain: 'tron',
      entity: 'DEMO-EXCHANGE-2',
      label: 'DEMO-EXCHANGE-2',
    },
    {
      id: 'n5',
      address: 'TDEMoCOLLECT2aa1234567890abcdefghijPQR',
      type: 'unknown',
      chain: 'tron',
      // Third VASP found by behavioural signal only — no label, only deposit pattern
      depositPattern: {
        contributorAddresses: [
          'TDEMoFRESH005aaaa1234567890eeeeeeeeeeee',
          'TDEMoFRESH006aaaa1234567890ffffffffffff',
          'TDEMoFRESH007aaaa1234567890gggggggggggg',
          'TDEMoFRESH008aaaa1234567890hhhhhhhhhhhh',
          'TDEMoFRESH009aaaa1234567890iiiiiiiiiiii',
          'TDEMoFRESH010aaaa1234567890jjjjjjjjjjjj',
        ],
        windowHours: 2,
        firstSeen: '2026-01-15T10:00:00Z',
        lastSeen: '2026-01-15T12:00:00Z',
      },
    },
    {
      id: 'n6',
      address: 'TDEMoVASP0003aaaa1234567890ccccccZZeeff',
      type: 'vasp',
      chain: 'tron',
      entity: 'DEMO-EXCHANGE-3',
      label: 'DEMO-EXCHANGE-3',
      // no label in label table — evidence is purely behavioural via n5
    },
  ],
  edges: [
    // n0 → n1: 48,000 USDT
    {
      id: 'e0',
      source: 'n0',
      target: 'n1',
      amount: 48000,
      token: 'USDT',
      timestamp: '2026-01-15T09:05:00Z',
      txHash: '0fade1deadbeefdeadbeefdeadbeefdeadbeef1234',
    },
    // n0 → n2 directly: 2,000 USDT  (total out n0 = 50,000)
    {
      id: 'e4',
      source: 'n0',
      target: 'n2',
      amount: 2000,
      token: 'USDT',
      timestamp: '2026-01-15T09:06:00Z',
      txHash: '0fade5deadbeefdeadbeefdeadbeefdeadbeef5678',
    },
    // n1 → n2: 45,000 USDT  (n1 total out = 45,000, share = 1.0)
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      amount: 45000,
      token: 'USDT',
      timestamp: '2026-01-15T09:20:00Z',
      txHash: '0fade2deadbeefdeadbeefdeadbeefdeadbeef2345',
    },
    // n2 → n3 DEMO-EXCHANGE-1: 38,000 USDT  (n2 total out = 45,000)
    {
      id: 'e2',
      source: 'n2',
      target: 'n3',
      amount: 38000,
      token: 'USDT',
      timestamp: '2026-01-15T12:01:00Z',
      txHash: '0fade3deadbeefdeadbeefdeadbeefdeadbeef3456',
    },
    // n2 → n4 DEMO-EXCHANGE-2: 7,000 USDT
    {
      id: 'e3',
      source: 'n2',
      target: 'n4',
      amount: 7000,
      token: 'USDT',
      timestamp: '2026-01-15T12:02:00Z',
      txHash: '0fade4deadbeefdeadbeefdeadbeefdeadbeef4567',
    },
    // n0 → n5 collector2: 500 USDT  (total out n0 = 50,500 — small split)
    // Note: n0 total outgoing is now 48000+2000+500 = 50500
    {
      id: 'e5',
      source: 'n0',
      target: 'n5',
      amount: 500,
      token: 'USDT',
      timestamp: '2026-01-15T09:07:00Z',
      txHash: '0fade6deadbeefdeadbeefdeadbeefdeadbeef6789',
    },
    // n5 → n6 DEMO-EXCHANGE-3: 480 USDT  (n5 total out = 480)
    {
      id: 'e6',
      source: 'n5',
      target: 'n6',
      amount: 480,
      token: 'USDT',
      timestamp: '2026-01-15T12:05:00Z',
      txHash: '0fade7deadbeefdeadbeefdeadbeefdeadbeef789a',
    },
  ],
};

export const DEMO_GRAPH_ETH: Graph = {
  nodes: [
    {
      id: 'n0',
      address: '0xdemo0000000000000000000000000000000000Aa',
      type: 'suspect',
      chain: 'ethereum',
      label: 'DEMO-SUSPECT-B',
    },
    {
      id: 'n1',
      address: '0xdemo1111111111111111111111111111111111Bb',
      type: 'bridge',
      chain: 'ethereum',
      entity: 'DEMO-BRIDGE-1',
      label: 'DEMO-BRIDGE-1',
    },
    {
      id: 'n2',
      address: '0xdemo2222222222222222222222222222222222Cc',
      type: 'unknown',
      chain: 'ethereum',
    },
    {
      id: 'n3',
      address: '0xdemo3333333333333333333333333333333333Dd',
      type: 'vasp',
      chain: 'ethereum',
      entity: 'DEMO-EXCHANGE-3',
      label: 'DEMO-EXCHANGE-3',
    },
    {
      id: 'n4',
      address: '0xdemo4444444444444444444444444444444444Ee',
      type: 'mixer',
      chain: 'ethereum',
      entity: 'DEMO-MIXER-1',
      label: 'DEMO-MIXER-1',
    },
    {
      id: 'n5',
      address: '0xdemo5555555555555555555555555555555555Ff',
      type: 'unknown',
      chain: 'ethereum',
    },
  ],
  edges: [
    {
      id: 'e0',
      source: 'n0',
      target: 'n1',
      amount: 12,
      token: 'ETH',
      timestamp: '2026-02-20T14:35:00Z',
      txHash: '0xeeee000000000000000000000000000000000000000000000000000000000001',
    },
    {
      id: 'e1',
      source: 'n1',
      target: 'n2',
      amount: 11.5,
      token: 'ETH',
      timestamp: '2026-02-20T14:40:00Z',
      txHash: '0xeeee111111111111111111111111111111111111111111111111111111111111',
    },
    {
      id: 'e2',
      source: 'n2',
      target: 'n3',
      amount: 8,
      token: 'ETH',
      timestamp: '2026-02-20T15:00:00Z',
      txHash: '0xeeee222222222222222222222222222222222222222222222222222222222222',
    },
    {
      id: 'e3',
      source: 'n2',
      target: 'n4',
      amount: 3.5,
      token: 'ETH',
      timestamp: '2026-02-20T15:01:00Z',
      txHash: '0xeeee333333333333333333333333333333333333333333333333333333333333',
    },
    {
      id: 'e4',
      source: 'n4',
      target: 'n5',
      amount: 1.5,
      token: 'ETH',
      timestamp: '2026-02-20T16:00:00Z',
      txHash: '0xeeee444444444444444444444444444444444444444444444444444444444444',
    },
  ],
};

export const SEED_LABELS: LabelEntry[] = [];

export const KNOWN_BRIDGES = [
  { address: '0xdemo1111111111111111111111111111111111Bb', entity: 'DEMO-BRIDGE-1' },
];

export const KNOWN_MIXERS = [
  { address: '0xdemo4444444444444444444444444444444444Ee', entity: 'DEMO-MIXER-1' },
];

export function buildDemoStateTron(): CaseState {
  return { ...DEMO_CASE_TRON, graph: DEMO_GRAPH_TRON, traceResult: null };
}

export function buildDemoStateEth(): CaseState {
  return { ...DEMO_CASE_ETHEREUM, graph: DEMO_GRAPH_ETH, traceResult: null };
}
