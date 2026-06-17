// src/utils/diff.ts
/**
 * On-chain state diff engine
 * Compares on‑chain contract information with repository contract definitions.
 * Returns a structured report suitable for audit pipelines.
 */

export type ContractInfo = {
  /** ABI JSON array as produced by the compiler */
  abi: any[];
  /** Deployed bytecode (hex string) */
  bytecode: string;
  /** Arbitrary state variables keyed by name */
  state: Record<string, unknown>;
};

export type DiffChange = {
  /** The category of the change */
  type: "abi" | "bytecode" | "state";
  /** The field that differed, e.g. function name or state variable */
  field: string;
  /** Expected value from repo */
  expected: unknown;
  /** Actual value from on‑chain */
  actual: unknown;
};

export type DiffResult = {
  /** Overall status – drift if any change is detected */
  status: "drift" | "match";
  /** List of granular changes */
  changes: DiffChange[];
  /** ISO timestamp of the report generation */
  timestamp: string;
};

/** Simple in‑memory cache to avoid re‑fetching on‑chain data within a run */
const onChainCache = new Map<string, ContractInfo>();

/**
 * Compare two ABI arrays.
 * Returns an array of DiffChange objects describing missing/changed members.
 */
function compareAbi(repoAbi: any[], onChainAbi: any[]): DiffChange[] {
  const changes: DiffChange[] = [];
  const repoFuncs = repoAbi.filter((e) => e.type === "function");
  const onChainFuncs = onChainAbi.filter((e) => e.type === "function");
  const repoEvents = repoAbi.filter((e) => e.type === "event");
  const onChainEvents = onChainAbi.filter((e) => e.type === "event");

  const mapByName = (arr: any[]) => {
    const map = new Map<string, any>();
    arr.forEach((item) => {
      const name = item.name || "<anonymous>";
      map.set(name, item);
    });
    return map;
  };

  const repoFuncMap = mapByName(repoFuncs);
  const onChainFuncMap = mapByName(onChainFuncs);

  // Missing functions
  for (const [name, def] of repoFuncMap.entries()) {
    if (!onChainFuncMap.has(name)) {
      changes.push({
        type: "abi",
        field: name,
        expected: def,
        actual: undefined,
      });
    } else {
      // Compare signatures (inputs & outputs)
      const onDef = onChainFuncMap.get(name);
      const sigEqual =
        JSON.stringify(def.inputs) === JSON.stringify(onDef.inputs) &&
        JSON.stringify(def.outputs) === JSON.stringify(onDef.outputs) &&
        def.stateMutability === onDef.stateMutability;
      if (!sigEqual) {
        changes.push({
          type: "abi",
          field: name,
          expected: def,
          actual: onDef,
        });
      }
    }
  }

  // Extra functions present on‑chain but not in repo (potential drift)
  for (const name of onChainFuncMap.keys()) {
    if (!repoFuncMap.has(name)) {
      changes.push({
        type: "abi",
        field: name,
        expected: undefined,
        actual: onChainFuncMap.get(name),
      });
    }
  }

  // Events – same logic as functions
  const repoEventMap = mapByName(repoEvents);
  const onChainEventMap = mapByName(onChainEvents);
  for (const [name, def] of repoEventMap.entries()) {
    if (!onChainEventMap.has(name)) {
      changes.push({
        type: "abi",
        field: `event:${name}`,
        expected: def,
        actual: undefined,
      });
    } else {
      const onDef = onChainEventMap.get(name);
      const inputsEqual = JSON.stringify(def.inputs) === JSON.stringify(onDef.inputs);
      if (!inputsEqual) {
        changes.push({
          type: "abi",
          field: `event:${name}`,
          expected: def,
          actual: onDef,
        });
      }
    }
  }
  for (const name of onChainEventMap.keys()) {
    if (!repoEventMap.has(name)) {
      changes.push({
        type: "abi",
        field: `event:${name}`,
        expected: undefined,
        actual: onChainEventMap.get(name),
      });
    }
  }

  return changes;
}

/** Compare bytecode hashes */
function compareBytecode(repoBytecode: string, onChainBytecode: string): DiffChange[] {
  if (repoBytecode === onChainBytecode) return [];
  return [
    {
      type: "bytecode",
      field: "bytecode",
      expected: repoBytecode,
      actual: onChainBytecode,
    },
  ];
}

/** Shallow state comparison */
function compareState(repoState: Record<string, unknown>, onChainState: Record<string, unknown>): DiffChange[] {
  const changes: DiffChange[] = [];
  const allKeys = new Set([...Object.keys(repoState), ...Object.keys(onChainState)]);
  for (const key of allKeys) {
    const repoVal = (repoState as any)[key];
    const onVal = (onChainState as any)[key];
    if (JSON.stringify(repoVal) !== JSON.stringify(onVal)) {
      changes.push({
        type: "state",
        field: key,
        expected: repoVal,
        actual: onVal,
      });
    }
  }
  return changes;
}

/**
 * Public diff entry point.
 * Caches on‑chain data for the same contract address within a process run.
 */
export async function diffContract(
  address: string,
  fetchOnChain: (address: string) => Promise<ContractInfo>,
  repoInfo: ContractInfo
): Promise<DiffResult> {
  // Retrieve on‑chain data, using cache when possible.
  let onChainInfo = onChainCache.get(address);
  if (!onChainInfo) {
    onChainInfo = await fetchOnChain(address);
    onChainCache.set(address, onChainInfo);
  }

  const changes: DiffChange[] = [];
  // ABI comparison
  changes.push(...compareAbi(repoInfo.abi, onChainInfo.abi));
  // Bytecode comparison
  changes.push(...compareBytecode(repoInfo.bytecode, onChainInfo.bytecode));
  // State comparison
  changes.push(...compareState(repoInfo.state, onChainInfo.state));

  const status = changes.length ? "drift" : "match";
  return {
    status,
    changes,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Example fetcher stub – in a real environment this would query the blockchain node.
 * It is exported for testing purposes so the test suite can provide a mock implementation.
 */
export async function stubFetchOnChain(address: string): Promise<ContractInfo> {
  // Placeholder – callers should supply a concrete implementation.
  // We return empty structures to keep the function signature pure.
  return {
    abi: [],
    bytecode: "",
    state: {},
  };
}
