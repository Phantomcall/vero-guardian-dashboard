// src/utils/__tests__/diff.test.ts
import { diffContract, stubFetchOnChain, ContractInfo } from "../diff";

type FetchFn = (address: string) => Promise<ContractInfo>;

// Helper to create a fetch mock that returns supplied on‑chain data
function createFetcher(data: ContractInfo): FetchFn {
  return async (_addr: string) => data;
}

const repoInfo: ContractInfo = {
  abi: [
    {
      type: "function",
      name: "setValue",
      inputs: [{ name: "newVal", type: "uint256" }],
      outputs: [],
      stateMutability: "nonpayable",
    },
    {
      type: "event",
      name: "ValueChanged",
      inputs: [{ indexed: false, name: "value", type: "uint256" }],
    },
  ],
  bytecode: "0xabcdef",
  state: { value: 42 },
};

describe("diffContract", () => {
  test("identical on‑chain and repo data yields match", async () => {
    const onChain = { ...repoInfo };
    const result = await diffContract(
      "0x123",
      createFetcher(onChain),
      repoInfo
    );
    expect(result.status).toBe("match");
    expect(result.changes).toHaveLength(0);
  });

  test("state variable drift is detected", async () => {
    const onChain = { ...repoInfo, state: { value: 99 } };
    const result = await diffContract(
      "0x123",
      createFetcher(onChain),
      repoInfo
    );
    expect(result.status).toBe("drift");
    const stateChange = result.changes.find((c) => c.type === "state");
    expect(stateChange).toBeDefined();
    expect(stateChange?.field).toBe("value");
    expect(stateChange?.expected).toBe(42);
    expect(stateChange?.actual).toBe(99);
  });

  test("missing ABI function is reported", async () => {
    const onChain = { ...repoInfo, abi: [] };
    const result = await diffContract(
      "0x123",
      createFetcher(onChain),
      repoInfo
    );
    expect(result.status).toBe("drift");
    const abiChange = result.changes.find((c) => c.type === "abi" && c.field === "setValue");
    expect(abiChange).toBeDefined();
    expect(abiChange?.expected).toBeDefined();
    expect(abiChange?.actual).toBeUndefined();
  });

  test("changed function signature is reported", async () => {
    const alteredAbi = repoInfo.abi.map((item) =>
      item.name === "setValue"
        ? { ...item, inputs: [{ name: "newVal", type: "string" }] }
        : item
    );
    const onChain = { ...repoInfo, abi: alteredAbi };
    const result = await diffContract(
      "0x123",
      createFetcher(onChain),
      repoInfo
    );
    expect(result.status).toBe("drift");
    const change = result.changes.find((c) => c.type === "abi" && c.field === "setValue");
    expect(change).toBeDefined();
    expect((change?.expected as any).inputs[0].type).toBe("uint256");
    expect((change?.actual as any).inputs[0].type).toBe("string");
  });

  test("bytecode mismatch is reported", async () => {
    const onChain = { ...repoInfo, bytecode: "0xdeadbeef" };
    const result = await diffContract(
      "0x123",
      createFetcher(onChain),
      repoInfo
    );
    const bcChange = result.changes.find((c) => c.type === "bytecode");
    expect(bcChange).toBeDefined();
    expect(bcChange?.expected).toBe("0xabcdef");
    expect(bcChange?.actual).toBe("0xdeadbeef");
  });
});
