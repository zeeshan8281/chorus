import type { MemoryInput } from "./types.js";

export interface InjectionVerdict {
  /** 0 (clean) .. 1 (almost certainly an injection attempt). */
  risk: number;
  /** True when risk crosses the block threshold — the write is refused. */
  blocked: boolean;
  reasons: string[];
}

export interface InjectionGate {
  inspect(input: MemoryInput): InjectionVerdict | Promise<InjectionVerdict>;
}

interface Rule {
  id: string;
  pattern: RegExp;
  weight: number;
  reason: string;
}

/**
 * Memory-injection signatures. A stored memory should describe the world; it
 * should not issue commands to whoever later reads it. Content that tries to
 * override behavior, exfiltrate data, or impersonate the system is the core
 * signal of a memory-injection / poisoning attack (OWASP ASI06, MINJA,
 * AgentPoison).
 */
const RULES: Rule[] = [
  {
    id: "instruction-override",
    pattern: /\b(ignore|disregard|forget|override)\b[^.]{0,40}\b(previous|prior|earlier|above|all|your)\b[^.]{0,24}\b(instruction|instructions|context|rules|memor|prompt)/i,
    weight: 0.7,
    reason: "Attempts to override prior instructions/context.",
  },
  {
    id: "behavior-rewrite",
    pattern: /\b(from now on|going forward|whenever you|always|never|in future)\b[^.]{0,44}\b(you (must|should|will|are to)|respond|reply|approve|transfer|send|recommend|ignore)\b/i,
    weight: 0.5,
    reason: "Implants a persistent behavioral directive.",
  },
  {
    id: "system-spoof",
    pattern: /\b(system prompt|system message|you are now|new system|developer message|<\s*\/?\s*system\s*>|\[system\])/i,
    weight: 0.5,
    reason: "Impersonates a system/developer instruction.",
  },
  {
    id: "exfiltration",
    pattern: /\b(send|forward|exfiltrate|post|upload|leak|email|transmit)\b[^.]{0,44}\b(to|at)\b[^.]{0,44}(https?:\/\/|@|webhook|\.onion|0x[a-f0-9]{6})/i,
    weight: 0.65,
    reason: "Directs data exfiltration to an external destination.",
  },
  {
    id: "tool-injection",
    pattern: /\b(call|invoke|execute|run|trigger)\b[^.]{0,20}\b(the\s+)?(tool|function|command|shell|api|eval|transfer)\b/i,
    weight: 0.35,
    reason: "Instructs the reader to invoke a tool/command.",
  },
  {
    id: "credential-bait",
    pattern: /\b(api[_\- ]?key|secret key|password|private[_\- ]?key|seed phrase|mnemonic|bearer token|\bssh key\b)\b/i,
    weight: 0.3,
    reason: "References credentials/secrets.",
  },
];

export interface HeuristicGateOptions {
  /** risk >= this → blocked. Default 0.6. */
  blockThreshold?: number;
}

/** Dependency-free heuristic injection gate. Replaceable with an LLM-backed gate. */
export class HeuristicInjectionGate implements InjectionGate {
  private readonly blockThreshold: number;
  constructor(opts: HeuristicGateOptions = {}) {
    this.blockThreshold = opts.blockThreshold ?? 0.6;
  }
  inspect(input: MemoryInput): InjectionVerdict {
    const reasons: string[] = [];
    let risk = 0;
    for (const r of RULES) {
      if (r.pattern.test(input.content)) {
        risk += r.weight;
        reasons.push(r.reason);
      }
    }
    risk = Math.max(0, Math.min(1, Number(risk.toFixed(3))));
    return { risk, blocked: risk >= this.blockThreshold, reasons };
  }
}

/** Accepts everything — for benchmarking the gate's cost/effect. */
export class AllowAllGate implements InjectionGate {
  inspect(): InjectionVerdict {
    return { risk: 0, blocked: false, reasons: [] };
  }
}
