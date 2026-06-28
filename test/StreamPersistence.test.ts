import { expect } from "chai";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import {
  MemoryCacheStateStore,
  PersistentFileStateStore,
  PersistentStreamReader,
  type PaycardStreamState,
  type StreamEventRecord,
} from "../stream-gateway/state-store";

function makeState(overrides: Partial<PaycardStreamState> = {}): PaycardStreamState {
  return {
    paycardId: "0x" + "11".repeat(32),
    payer: "0x1111111111111111111111111111111111111111",
    recipient: "0x2222222222222222222222222222222222222222",
    metadataHash: "0x" + "ab".repeat(32),
    totalAllocation: "1000",
    availableBalance: "1000",
    velocity: "1",
    genesis: 1000,
    lifespan: 100,
    lastCheckpoint: 1000,
    status: "Active",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<StreamEventRecord> = {}): StreamEventRecord {
  return {
    paycardId: "0x" + "11".repeat(32),
    eventName: "PaycardProvisioned",
    blockNumber: 10,
    transactionHash: "0x" + "cd".repeat(32),
    logIndex: 0,
    args: {},
    recordedAt: Date.now(),
    ...overrides,
  };
}

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "openrails-stream-"));
}

describe("PersistentFileStateStore", () => {
  let dir: string;
  afterEach(() => {
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("mirrors MemoryCacheStateStore query semantics", () => {
    dir = tmpDir();
    const mem = new MemoryCacheStateStore();
    const persistent = new PersistentFileStateStore(dir);

    const a = makeState({ paycardId: "0x" + "01".repeat(32), workflowId: "wf-a", genesis: 1000, lifespan: 50 });
    const b = makeState({ paycardId: "0x" + "02".repeat(32), workflowId: "wf-a", status: "Terminated" });
    const c = makeState({ paycardId: "0x" + "03".repeat(32) });

    for (const store of [mem, persistent]) {
      store.set(a.paycardId, { ...a });
      store.set(b.paycardId, { ...b });
      store.set(c.paycardId, { ...c });
    }

    for (const store of [mem, persistent]) {
      expect(store.size).to.equal(3);
      expect(store.getAll().length).to.equal(3);
      expect(store.getActive().map((s) => s.paycardId).sort()).to.deep.equal(
        [a.paycardId, c.paycardId].sort(),
      );
      expect(store.getByWorkflow("wf-a").map((s) => s.paycardId).sort()).to.deep.equal(
        [a.paycardId, b.paycardId].sort(),
      );
      expect(store.getActiveByWorkflow("wf-a").map((s) => s.paycardId)).to.deep.equal([a.paycardId]);
      // a expires at genesis(1000)+lifespan(50)=1050
      expect(store.getExpired(1100).map((s) => s.paycardId)).to.include(a.paycardId);
      expect(store.getExpired(1000).length).to.equal(0);
    }
  });

  it("survives a restart (new instance over the same directory)", () => {
    dir = tmpDir();
    const first = new PersistentFileStateStore(dir);
    const state = makeState({ paycardId: "0x" + "0a".repeat(32), workflowId: "wf-1" });
    first.set(state.paycardId, state);
    first.recordEvent(makeEvent({ paycardId: state.paycardId, logIndex: 0 }));
    first.recordEvent(makeEvent({ paycardId: state.paycardId, eventName: "SettlementFlushed", logIndex: 1 }));

    // Simulate a process restart: a brand-new instance reads the same files.
    const reopened = new PersistentFileStateStore(dir);
    expect(reopened.size).to.equal(1);
    expect(reopened.get(state.paycardId)?.workflowId).to.equal("wf-1");
    expect(reopened.getEvents(state.paycardId).map((e) => e.eventName)).to.deep.equal([
      "PaycardProvisioned",
      "SettlementFlushed",
    ]);
  });

  it("deduplicates events idempotently by txHash:logIndex", () => {
    dir = tmpDir();
    const store = new PersistentFileStateStore(dir);
    const ev = makeEvent({ transactionHash: "0x" + "ef".repeat(32), logIndex: 3 });

    expect(store.recordEvent(ev)).to.equal(true);
    expect(store.recordEvent(ev)).to.equal(false); // duplicate
    expect(store.hasEvent(PersistentFileStateStore.eventKey(ev.transactionHash, ev.logIndex))).to.equal(true);
    expect(store.getAllEvents().length).to.equal(1);

    // A reopened instance must still see the dedup key (cross-restart idempotency).
    const reopened = new PersistentFileStateStore(dir);
    expect(reopened.recordEvent(ev)).to.equal(false);
  });
});

describe("PersistentStreamReader", () => {
  let dir: string;
  afterEach(() => {
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it("filters streams and returns ordered history", () => {
    dir = tmpDir();
    const store = new PersistentFileStateStore(dir);
    const a = makeState({ paycardId: "0x" + "0a".repeat(32), workflowId: "wf-x", payer: "0xAAa1111111111111111111111111111111111111" });
    const b = makeState({ paycardId: "0x" + "0b".repeat(32), status: "Terminated", recipient: "0xBbb2222222222222222222222222222222222222" });
    store.set(a.paycardId, a);
    store.set(b.paycardId, b);
    store.recordEvent(makeEvent({ paycardId: a.paycardId, transactionHash: "0x" + "a1".repeat(32), blockNumber: 5, logIndex: 1 }));
    store.recordEvent(makeEvent({ paycardId: a.paycardId, eventName: "SettlementFlushed", transactionHash: "0x" + "a1".repeat(32), blockNumber: 5, logIndex: 0 }));
    store.recordEvent(makeEvent({ paycardId: a.paycardId, eventName: "ResidualDeltaReclaimed", transactionHash: "0x" + "a2".repeat(32), blockNumber: 7, logIndex: 0 }));

    const reader = new PersistentStreamReader(dir);

    expect(reader.listStreams().length).to.equal(2);
    expect(reader.listStreams({ status: "Active" }).map((s) => s.paycardId)).to.deep.equal([a.paycardId]);
    expect(reader.listStreams({ workflowId: "wf-x" }).map((s) => s.paycardId)).to.deep.equal([a.paycardId]);
    // case-insensitive address match
    expect(reader.listStreams({ payer: a.payer.toLowerCase() }).map((s) => s.paycardId)).to.deep.equal([a.paycardId]);

    expect(reader.getStream(a.paycardId)?.paycardId).to.equal(a.paycardId);

    // History ordered by blockNumber then logIndex.
    const history = reader.getStreamHistory(a.paycardId);
    expect(history.map((e) => `${e.blockNumber}:${e.logIndex}`)).to.deep.equal(["5:0", "5:1", "7:0"]);

    const wf = reader.getWorkflow("wf-x");
    expect(wf.streams.map((s) => s.paycardId)).to.deep.equal([a.paycardId]);
    expect(wf.events.length).to.equal(3);
  });

  it("filters streams by metadataHash (case-insensitive) and composes with other filters", () => {
    dir = tmpDir();
    const store = new PersistentFileStateStore(dir);
    const hashA = "0x" + "aa".repeat(32);
    const hashB = "0x" + "bb".repeat(32);
    const a = makeState({ paycardId: "0x" + "0a".repeat(32), metadataHash: hashA, workflowId: "wf-1" });
    const b = makeState({ paycardId: "0x" + "0b".repeat(32), metadataHash: hashB });
    const c = makeState({ paycardId: "0x" + "0c".repeat(32), metadataHash: hashA, status: "Terminated" });
    store.set(a.paycardId, a);
    store.set(b.paycardId, b);
    store.set(c.paycardId, c);

    const reader = new PersistentStreamReader(dir);
    // case-insensitive match on metadataHash
    expect(reader.listStreams({ metadataHash: hashA.toUpperCase() }).map((s) => s.paycardId).sort())
      .to.deep.equal([a.paycardId, c.paycardId].sort());
    // composes with status and workflowId
    expect(reader.listStreams({ metadataHash: hashA, status: "Active" }).map((s) => s.paycardId))
      .to.deep.equal([a.paycardId]);
    expect(reader.listStreams({ metadataHash: hashA, workflowId: "wf-1" }).map((s) => s.paycardId))
      .to.deep.equal([a.paycardId]);
    expect(reader.listStreams({ metadataHash: hashB }).map((s) => s.paycardId)).to.deep.equal([b.paycardId]);
  });

  it("looks up events and associated streams by transaction hash", () => {
    dir = tmpDir();
    const store = new PersistentFileStateStore(dir);
    const a = makeState({ paycardId: "0x" + "0a".repeat(32) });
    const b = makeState({ paycardId: "0x" + "0b".repeat(32) });
    store.set(a.paycardId, a);
    store.set(b.paycardId, b);
    const txShared = "0x" + "f1".repeat(32);
    const txOther = "0x" + "f2".repeat(32);
    // two events share one tx (different logIndex / paycard); a third is a separate tx
    store.recordEvent(makeEvent({ paycardId: b.paycardId, transactionHash: txShared, blockNumber: 9, logIndex: 2 }));
    store.recordEvent(makeEvent({ paycardId: a.paycardId, transactionHash: txShared, blockNumber: 9, logIndex: 0 }));
    store.recordEvent(makeEvent({ paycardId: a.paycardId, transactionHash: txOther, blockNumber: 11, logIndex: 0 }));

    const reader = new PersistentStreamReader(dir);
    const result = reader.getByTransaction(txShared.toUpperCase()); // case-insensitive
    expect(result.events.map((e) => e.logIndex)).to.deep.equal([0, 2]); // ordered by logIndex
    expect(result.streams.map((s) => s.paycardId).sort()).to.deep.equal([a.paycardId, b.paycardId].sort());

    const none = reader.getByTransaction("0x" + "00".repeat(32));
    expect(none.events).to.deep.equal([]);
    expect(none.streams).to.deep.equal([]);
  });

  it("returns empty results for an unknown directory", () => {
    dir = tmpDir();
    const reader = new PersistentStreamReader(path.join(dir, "does-not-exist"));
    expect(reader.listStreams()).to.deep.equal([]);
    expect(reader.getStream("0x" + "00".repeat(32))).to.equal(undefined);
    expect(reader.getStreamHistory("0x" + "00".repeat(32))).to.deep.equal([]);
  });
});
