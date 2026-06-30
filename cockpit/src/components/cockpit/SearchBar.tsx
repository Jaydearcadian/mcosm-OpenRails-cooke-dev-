import { useState } from "react";

export type SearchKind = "address" | "paycard";
export interface SearchQuery {
  kind: SearchKind;
  value: string;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const PAYCARD_RE = /^0x[0-9a-fA-F]{64}$/;

export function detectKind(raw: string): SearchKind | null {
  const v = raw.trim();
  if (ADDRESS_RE.test(v)) return "address";
  if (PAYCARD_RE.test(v)) return "paycard";
  return null;
}

/** One input that accepts a wallet address (0x…40) or a Paycard ID (0x…64). */
export function SearchBar({ onSearch, busy }: { onSearch: (q: SearchQuery) => void; busy: boolean }) {
  const [text, setText] = useState("");
  const kind = detectKind(text);
  const invalid = text.trim().length > 0 && kind === null;

  function submit() {
    const v = text.trim();
    if (!kind) return;
    onSearch({ kind, value: v });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="glass-soft flex flex-1 items-center gap-3 px-4 py-3">
          <span className="font-mono text-sm text-emerald-core">⊞</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            spellCheck={false}
            placeholder="Search by wallet address (0x…) or Paycard ID (0x…)"
            aria-label="Search by wallet address or Paycard ID"
            className="min-w-0 flex-1 bg-transparent font-mono text-sm text-ink-primary placeholder:text-ink-faint focus:outline-none"
          />
          {kind && (
            <span className="shrink-0 font-mono text-[10px] uppercase tracking-widest2 text-emerald-core">
              {kind === "address" ? "address" : "paycard id"}
            </span>
          )}
        </div>
        <button
          onClick={submit}
          disabled={!kind || busy}
          className="shrink-0 rounded-xl bg-emerald-core px-5 py-3 font-mono text-sm font-semibold text-[#04070D] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "…" : "Search"}
        </button>
      </div>
      {invalid && (
        <p className="font-mono text-[11px] text-amber-400/80">
          Enter a 42-char wallet address or a 66-char Paycard ID (both `0x`-prefixed hex).
        </p>
      )}
    </div>
  );
}
