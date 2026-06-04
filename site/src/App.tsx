import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import LiveDemo from "@/components/LiveDemo";
import wordmark from "@/assets/eigen/wordmark-light.svg";

const GH = "https://github.com/zeeshan8281/chorus";

export default function App() {
  return (
    <div className="min-h-screen text-foreground">
      <Nav />
      <main className="mx-auto max-w-6xl px-6">
        <Hero />
        <Threats />
        <HowItWorks />
        <Demo />
        <Comparison />
        <Features />
        <CodeBlock />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/60 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#top" className="flex items-center gap-3">
          <img src={wordmark} alt="EigenLayer" className="h-5 w-auto" />
          <span className="text-muted-foreground">/</span>
          <span className="text-sm font-medium">Verifiable Memory</span>
        </a>
        <div className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
          <a className="hover:text-foreground" href="#threats">Threats</a>
          <a className="hover:text-foreground" href="#how">How it works</a>
          <a className="hover:text-foreground" href="#demo">Live demo</a>
          <a className="hover:text-foreground" href="#api">API</a>
        </div>
        <a href={GH} target="_blank" rel="noreferrer">
          <Button variant="outline" size="sm">GitHub ★</Button>
        </a>
      </nav>
    </header>
  );
}

const FEED = [
  '<span class="text-muted-foreground">$</span> agent <span class="text-indigo-300">billing-agent</span> → POST /v1/memories',
  '<span class="text-muted-foreground">  hash……</span> sha256(canonical) <span class="text-indigo-300">9f3c…a1</span>',
  '<span class="text-muted-foreground">  sign……</span> <span class="text-indigo-300">secp256k1 304402…</span>',
  '<span class="text-muted-foreground">  commit…</span> <span class="text-emerald-400">leaf #42 → merkle root signed</span>',
  "&nbsp;",
  '<span class="text-muted-foreground">$</span> operator edits the memory in the DB',
  '<span class="text-red-400">  content_hash mismatch → proof invalid</span>',
  "&nbsp;",
  '<span class="text-muted-foreground">$</span> client → GET /v1/memories/:id  + verify',
  '<span class="text-emerald-400">  ✓ tee-key ✓ signature ✓ leaf ✓ inclusion ✓ root</span>',
  '<span class="text-indigo-300">  VERIFIED · operator cannot tamper</span>',
];

function HeroFeed() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= FEED.length) {
      const t = setTimeout(() => setN(0), 4200);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((x) => x + 1), n < 4 ? 360 : 280);
    return () => clearTimeout(t);
  }, [n]);
  return (
    <Card className="bg-card/60">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>live feed · memory bus</span>
        <span>Intel TDX</span>
      </div>
      <div className="min-h-[300px] space-y-1 p-4 font-mono text-[12.5px] leading-relaxed">
        {FEED.slice(0, n).map((l, i) => (
          <div key={i} dangerouslySetInnerHTML={{ __html: l }} />
        ))}
      </div>
    </Card>
  );
}

function Hero() {
  return (
    <section id="top" className="grid items-center gap-12 py-20 md:grid-cols-[1.05fr_0.95fr] md:py-24">
      <div>
        <Badge variant="outline" className="font-mono text-muted-foreground">
          Observability Series · Part 3 · EigenLabs
        </Badge>
        <h1 className="mt-6 font-heading text-5xl leading-[1.02] font-bold tracking-tight md:text-6xl">
          Memory your agents
          <br />
          <span className="text-muted-foreground">can prove.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted-foreground">
          Tamper-evident persistent memory for AI agents. Every write is hashed, <span className="text-foreground">secp256k1-signed</span>,
          and committed to a <span className="text-foreground">Merkle tree</span>; every read returns an <span className="text-foreground">inclusion proof</span>.
          It runs inside an <span className="text-foreground">Intel TDX TEE on EigenCompute</span> — so the operator can't inject, edit, delete, or replay a memory.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="#demo"><Button size="lg">Try the live demo →</Button></a>
          <a href={GH} target="_blank" rel="noreferrer"><Button size="lg" variant="outline">GitHub ★</Button></a>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 font-mono text-sm text-muted-foreground">
          <code className="rounded-md border border-border bg-card px-3 py-1.5">npm i verifiable-agent-memory</code>
          <span>Node 20 · PostgreSQL · Intel TDX</span>
        </div>
      </div>
      <HeroFeed />
    </section>
  );
}

const THREATS = [
  { tag: "INJECTION", title: "False memories", body: "An operator inserts fabricated context to steer the agent. Unsigned writes carry no valid commitment.", stat: "blocked by signatures" },
  { tag: "TAMPERING", title: "Silent edits", body: "Stored memory is modified after the fact. It no longer hashes to its Merkle leaf — the proof fails.", stat: "caught by Merkle proof" },
  { tag: "DELETION", title: "Evidence removal", body: "Inconvenient memories are dropped. Deletes are soft, signed, and appended — never erased.", stat: "auditable forever" },
  { tag: "REPLAY", title: "Stale state", body: "An old snapshot is replayed. Each read carries the current signed root; the tree only grows.", stat: "monotonic root" },
];

function Threats() {
  return (
    <Section id="threats" kicker="The problem" title="If you control what an agent remembers, you control what it does."
      lead="Memory layers are opaque databases controlled by whoever runs the infra. When agents manage money or act autonomously, that's a critical attack surface.">
      <div className="grid gap-4 md:grid-cols-2">
        {THREATS.map((t) => (
          <Card key={t.title} className="p-6 transition-colors hover:border-indigo-400/40">
            <div className="font-mono text-xs tracking-wider text-red-400">{t.tag}</div>
            <h3 className="mt-3 text-lg font-medium">{t.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t.body}</p>
            <div className="mt-4 border-t border-border pt-3 text-sm text-emerald-400">✓ {t.stat}</div>
          </Card>
        ))}
      </div>
    </Section>
  );
}

const PIPES = [
  { h: "Write", steps: [["Canonicalize + hash", "Deterministic bytes → SHA-256 content hash."], ["secp256k1 sign", "The TEE-sealed key signs (hash ‖ agent ‖ ts ‖ op)."], ["Append to Merkle tree", "A leaf is added; the root advances."], ["Commitment log", "The operation is recorded append-only."]] },
  { h: "Read", steps: [["Fetch memory", "From Postgres inside the enclave."], ["Inclusion proof", "Merkle path from the leaf to the current root."], ["Set-completeness", "Search returns a signed proof of the full result set."], ["Attestation", "Served with the TDX attestation + TEE key."]] },
  { h: "Client verifies", steps: [["TEE key", "Matches the on-chain / dashboard attestation."], ["Signature", "Commitment signed by the attested key."], ["Leaf binding", "Content still hashes to its committed leaf."], ["Inclusion", "Leaf is under the signed root."]] },
];

function HowItWorks() {
  return (
    <Section id="how" kicker="How it works" title="Commit on write. Prove on read. Sealed by the TEE.">
      <div className="grid gap-4 md:grid-cols-3">
        {PIPES.map((p) => (
          <Card key={p.h} className="p-6">
            <div className="font-mono text-xs tracking-wider text-indigo-300">{p.h.toUpperCase()}</div>
            <div className="mt-4 space-y-3">
              {p.steps.map(([b, s], i) => (
                <div key={b} className="flex gap-3">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-foreground text-[11px] font-semibold text-background">{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium">{b}</div>
                    <div className="text-xs text-muted-foreground">{s}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-6 max-w-3xl rounded-xl border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground">
        On EigenCompute the signing key is sealed to the attested Docker image digest. Forging or editing a memory needs different
        code — a different digest — which <span className="text-foreground">fails attestation</span>. Verify at{" "}
        <span className="font-mono text-indigo-300">verify-sepolia.eigencloud.xyz</span>.
      </p>
    </Section>
  );
}

function Demo() {
  return (
    <Section id="demo" kicker="Receipts, for real" title="Write a memory. Tamper with it. Watch the proof break."
      lead="This panel computes real SHA-256 Merkle roots and inclusion proofs in your browser — the same scheme the service uses.">
      <LiveDemo />
    </Section>
  );
}

const ROWS: [string, boolean, string][] = [
  ["store & recall (Mem0 API)", true, "yes"],
  ["who wrote it (provenance)", false, "secp256k1 signature"],
  ["detect tampering / edits", false, "Merkle leaf binding"],
  ["prove nothing was omitted", false, "set-completeness proof"],
  ["deletions stay auditable", false, "signed soft-delete"],
  ["operator can't tamper", false, "Intel TDX + sealed key"],
];

function Comparison() {
  return (
    <Section kicker="Mem0 vs Verifiable Memory" title="A drop-in memory API — with commitments baked in.">
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="px-5 py-3 font-medium">Capability</th>
              <th className="px-5 py-3 font-medium">Opaque memory DB</th>
              <th className="px-5 py-3 font-medium">Verifiable Memory</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([cap, ok, val]) => (
              <tr key={cap} className="border-b border-border/60 last:border-0">
                <td className="px-5 py-3 text-muted-foreground">{cap}</td>
                <td className={ok ? "px-5 py-3 text-emerald-400" : "px-5 py-3 text-red-400"}>{ok ? "✓ yes" : "✗ no"}</td>
                <td className="px-5 py-3 text-emerald-400">✓ {val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

const FEATURES = [
  ["Mem0-compatible API", "add / get / search / update / delete / history over a REST surface agent frameworks expect."],
  ["secp256k1 commitments", "Every write is signed with the TEE wallet key — same curve as Ethereum, with a derived 0x address."],
  ["Merkle inclusion proofs", "Append-only SHA-256 tree. Each read returns a path the client recomputes to the signed root."],
  ["Set-completeness proofs", "Search results carry a TEE-signed proof that no matching memory was selectively omitted."],
  ["Auditable soft-delete + TTL", "Deletions and expirations append signed DELETE commitments — gone from reads, kept in history."],
  ["TDX attestation", "Image digest + KMS key fingerprint, verifiable on the EigenCloud dashboard."],
];

function Features() {
  return (
    <Section id="api" kicker="What you get" title="Everything needed to trust a memory you didn't write.">
      <div className="grid gap-4 md:grid-cols-3">
        {FEATURES.map(([t, b]) => (
          <Card key={t} className="p-6 transition-colors hover:border-indigo-400/40">
            <h3 className="font-medium">{t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{b}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

const SNIPPETS: Record<string, string> = {
  library: `import { MemoryService, verifyMemory } from "verifiable-agent-memory";

const m = await svc.create({
  content: "User authorized $50/mo to Acme Corp",
  agentId: "billing-agent",
  tags: ["payment", "authorization"],
});

const read = await svc.get(m.id);              // memory + Merkle proof
const result = verifyMemory(read, read.teePublicKey);
result.ok;     // true
result.checks; // { teeKey, signature, leafBinding, inclusion, rootMatch }`,
  http: `# create (201) — hashed, secp256k1-signed, committed
curl -X POST $URL/v1/memories -H 'content-type: application/json' \\
  -d '{"content":"...","agentId":"billing-agent","tags":["payment"]}'

# read one memory WITH an inclusion proof + attestation
curl $URL/v1/memories/$ID

# search → proofs + a set-completeness proof
curl "$URL/v1/memories?agentId=billing-agent&tags=payment"`,
  deploy: `# deploy into an Intel TDX enclave on EigenCompute
ecloud compute app create --name verifiable-memory --language typescript
ecloud compute app deploy        # "Build and deploy from Dockerfile"

# Node + PostgreSQL 16 co-located in one TEE container.
# verify at https://verify-sepolia.eigencloud.xyz`,
};

function CodeBlock() {
  const [tab, setTab] = useState<keyof typeof SNIPPETS>("library");
  return (
    <Section kicker="Quickstart" title="Drop it into your agent loop.">
      <Card className="overflow-hidden">
        <div className="flex border-b border-border">
          {(Object.keys(SNIPPETS) as (keyof typeof SNIPPETS)[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`border-r border-border px-5 py-3 text-sm transition-colors ${tab === k ? "border-b-2 border-b-indigo-400 text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {k}
            </button>
          ))}
        </div>
        <pre className="overflow-auto bg-black/30 p-5 font-mono text-[12.5px] leading-relaxed">{SNIPPETS[tab]}</pre>
      </Card>
    </Section>
  );
}

const FAQS: [string, string][] = [
  ["What stops an operator injecting false memories?", "Every committed memory is signed by the TEE-sealed secp256k1 key. An operator can write a row into Postgres, but it won't carry a valid signature or sit under the signed Merkle root — so verifyMemory rejects it."],
  ["How is tampering detected?", "The content hash is committed into the Merkle leaf. If stored content is edited, it no longer hashes to that leaf and the inclusion proof fails. The original signed hash also stays in the append-only commitment log."],
  ["Why can't the operator just delete a memory?", "Deletes are soft and signed: a DELETE commitment is appended to the append-only tree and the row is flagged. History still proves the memory existed and when it was removed."],
  ["How does the TEE guarantee work?", "On EigenCompute the app runs in an Intel TDX enclave and the KMS releases the signing key only to the attested image digest. Different code → different digest → failed attestation."],
];

function FAQ() {
  return (
    <Section kicker="FAQ" title="Straight answers.">
      <Card className="px-6">
        {FAQS.map(([q, a], i) => (
          <details key={q} className={`group py-1 ${i > 0 ? "border-t border-border" : ""}`}>
            <summary className="cursor-pointer list-none py-4 font-medium [&::-webkit-details-marker]:hidden">
              <span className="text-indigo-300">Q.</span> {q}
            </summary>
            <p className="pb-4 pl-6 text-sm leading-relaxed text-muted-foreground">{a}</p>
          </details>
        ))}
      </Card>
    </Section>
  );
}

function CTA() {
  return (
    <section className="py-20">
      <Card className="items-center px-8 py-16 text-center">
        <div className="font-mono text-xs uppercase tracking-wider text-indigo-300">Part 3 of the Observability Series</div>
        <h2 className="mt-4 font-heading text-4xl font-bold tracking-tight">
          Trace it. Verify it. <span className="text-muted-foreground">Now prove what it remembers.</span>
        </h2>
        <div className="mt-8 flex justify-center gap-3">
          <a href={GH} target="_blank" rel="noreferrer"><Button size="lg">View on GitHub ★</Button></a>
          <a href="#demo"><Button size="lg" variant="outline">Replay the demo</Button></a>
        </div>
      </Card>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-10 text-center font-mono text-xs text-muted-foreground">
        Verifiable Agent Memory · Observability Series Part 3 · EigenLabs · Intel TDX · EigenCompute
      </div>
    </footer>
  );
}

function Section({ id, kicker, title, lead, children }: { id?: string; kicker: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="py-16">
      <div className="font-mono text-xs uppercase tracking-wider text-indigo-300">{kicker}</div>
      <h2 className="mt-3 max-w-3xl font-heading text-3xl font-bold tracking-tight md:text-4xl">{title}</h2>
      {lead && <p className="mt-4 max-w-2xl text-muted-foreground">{lead}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}
