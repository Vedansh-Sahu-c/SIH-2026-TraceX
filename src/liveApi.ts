import type { Graph, GraphNode, GraphEdge, Chain } from './types';

const TRONGRID_BASE = 'https://api.trongrid.io';

export interface TronTransfer {
  from: string;
  to: string;
  value: number;
  transaction_id: string;
  block_timestamp: number;
}

export interface LiveFetchResult {
  graph: Graph;
  error?: string;
}

const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'; // real USDT contract on Tron

export async function fetchTronTransfers(
  address: string,
  options?: { signal?: AbortSignal }
): Promise<Graph> {
  const url = `${TRONGRID_BASE}/v1/accounts/${address}/trc20/transfers?limit=50&contract_address=${USDT_CONTRACT}`;

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: { 'TRON-PRO-API-KEY': '' },
      signal: options?.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out.');
    }
    throw new Error('Network error reaching TronGrid.');
  }

  if (resp.status === 429) {
    throw new Error('TronGrid rate limit reached (429). Please retry shortly.');
  }
  if (!resp.ok) {
    throw new Error(`TronGrid returned HTTP ${resp.status}.`);
  }

  const data = await resp.json();
  const transfers: TronTransfer[] = data.data || [];

  if (transfers.length === 0) {
    // empty graph with just the suspect
    return buildGraphFromTransfers(address, [], 'tron');
  }

  return buildGraphFromTransfers(address, transfers, 'tron');
}

function buildGraphFromTransfers(
  suspectAddress: string,
  transfers: TronTransfer[],
  chain: Chain
): Graph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, GraphNode>();

  function getOrCreateNode(addr: string): GraphNode {
    if (nodeMap.has(addr)) return nodeMap.get(addr)!;
    const isSuspect = addr === suspectAddress;
    const node: GraphNode = {
      id: addr,
      address: addr,
      type: isSuspect ? 'suspect' : 'unknown',
      chain,
    };
    nodes.push(node);
    nodeMap.set(addr, node);
    return node;
  }

  getOrCreateNode(suspectAddress);

  for (const t of transfers) {
    const from = t.from;
    const to = t.to;
    getOrCreateNode(from);
    getOrCreateNode(to);
    const amount = t.value / 1_000_000; // USDT has 6 decimals
    edges.push({
      id: t.transaction_id + '-' + from.slice(-4) + '-' + to.slice(-4),
      source: from,
      target: to,
      amount,
      token: 'USDT',
      timestamp: new Date(t.block_timestamp).toISOString(),
      txHash: t.transaction_id,
    });
  }

  return { nodes, edges };
}

export function fetchWithTimeout(
  address: string,
  timeoutMs = 15000
): Promise<Graph> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetchTronTransfers(address, { signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
}
