import { useEffect, useState } from "react";

const GH = "https://github.com/zeeshan8281/chorus";

function Mark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="eig" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a77dff" />
          <stop offset="1" stopColor="#8ae06c" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="26" height="26" rx="6" stroke="url(#eig)" strokeWidth="2" />
      <path d="M11 16 L15 20 L21 12" stroke="url(#eig)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="brand" href="#top">
          <Mark /> Verifiable Memory <span className="tag">EIGENCOMPUTE</span>
        </a>
        <div className="nav-links">
          <a href="#why">Threats</a>
          <a href="#how">How it works</a>
          <a href="#demo">Live demo</a>
          <a href="#code">API</a>
          <a href="#faq">FAQ</a>
        </div>
        <a className="ghbtn" href={GH} target="_blank" rel="noreferrer">
          GitHub ★
        </a>
      </div>
    </nav>
  );
}

const FEED = [
  '<span class="d">$</span> agent <span class="c">billing-agent</span> → POST /v1/memories',
  '<span class="d">  hash……</span> sha256(canonical) <span class="am">9f3c…a1</span>',
  '<span class="d">  sign……</span> <span class="am">secp256k1 304402…</span>',
  '<span class="d">  commit…</span> <span class="ok">leaf #42 → merkle root signed</span>',
  "&nbsp;",
  '<span class="d">$</span> operator tries to edit memory in the DB',
  '<span class="bad">  content_hash mismatch → proof invalid</span> <span class="tagbad">DETECTED</span>',
  "&nbsp;",
  '<span class="d">$</span> client → GET /v1/memories/:id  + verify',
  '<span class="ok">  ✓ tee-key ✓ signature ✓ leaf ✓ inclusion ✓ root</span>',
  '<span class="am">  VERIFIED · operator cannot tamper</span>',
];

export function HeroFeed() {
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
    <div className="panel">
      <div className="ph cyan">
        live feed · memory bus <span className="meta">Intel TDX</span>
      </div>
      <div className="feed-body">
        {FEED.slice(0, n).map((l, i) => (
          <div key={i} className="feed-line" dangerouslySetInnerHTML={{ __html: l }} />
        ))}
      </div>
    </div>
  );
}

export function Hero() {
  return (
    <header className="hero" id="top">
      <div>
        <span className="eyebrow">Observability Series · Part 3 · EigenLabs</span>
        <h1>
          Memory your agents
          <br />
          <span className="grad">can prove.</span>
        </h1>
        <p className="sub">
          Tamper-evident persistent memory for AI agents. Every write is hashed, <b>secp256k1-signed</b>, and committed
          to a <b>Merkle tree</b>; every read returns an <b>inclusion proof</b>. The whole layer runs inside an{" "}
          <b>Intel TDX TEE on EigenCompute</b>, so the operator can't inject, edit, delete, or replay a memory — and any
          client can verify it.
        </p>
        <div className="hero-cta">
          <a className="btn btn-primary" href="#demo">
            Try the live demo →
          </a>
          <a className="btn btn-ghost" href={GH} target="_blank" rel="noreferrer">
            GitHub ★
          </a>
        </div>
        <div className="install">
          <code>npm i verifiable-agent-memory</code>
          <span className="dim">· Node 20 · PostgreSQL · Intel TDX</span>
        </div>
      </div>
      <HeroFeed />
    </header>
  );
}

const THREATS = [
  { tag: "INJECTION", title: "False memories", body: "An operator inserts fabricated context — “the user authorized a $50,000 transfer” — to steer the agent. Unsigned writes have no valid commitment.", stat: "blocked by signatures" },
  { tag: "TAMPERING", title: "Silent edits", body: "Stored memory is modified after the fact. The content no longer hashes to its committed Merkle leaf, so the proof fails.", stat: "caught by Merkle proof" },
  { tag: "DELETION", title: "Evidence removal", body: "Inconvenient memories are quietly dropped. Deletes are soft + signed and appended to the append-only tree — never erased.", stat: "auditable forever" },
  { tag: "REPLAY", title: "Stale state", body: "An old snapshot is served to trick the agent into repeating an action. Each read carries the current signed root; the tree only grows.", stat: "monotonic root" },
];

export function Threats() {
  return (
    <section className="section" id="why">
      <span className="kicker">The problem</span>
      <h2>If you control what an agent remembers, you control what it does.</h2>
      <p className="lead">
        Today's memory layers are opaque databases controlled by whoever runs the infrastructure. When agents manage
        money or act autonomously, that's a critical attack surface.
      </p>
      <div className="grid g4">
        {THREATS.map((t) => (
          <div className="tcard" key={t.title}>
            <div className="tcard-h">{t.tag}</div>
            <h3>{t.title}</h3>
            <p>{t.body}</p>
            <div className="tstat">✓ {t.stat}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section className="section" id="how">
      <span className="kicker">How it works</span>
      <h2>Commit on write. Prove on read. Sealed by the TEE.</h2>
      <div className="grid g3">
        <div className="panel pipe">
          <div className="ph">Write</div>
          <div className="pb">
            <Step n={1} b="Canonicalize + hash" s="Deterministic bytes → SHA-256 content hash." />
            <Step n={2} b="secp256k1 sign" s="The TEE-sealed key signs (hash ‖ agent ‖ ts ‖ op)." />
            <Step n={3} b="Append to Merkle tree" s="A leaf is added; the root advances." />
            <Step n={4} b="Commitment log" s="The operation is recorded append-only." />
          </div>
        </div>
        <div className="panel pipe">
          <div className="ph">Read</div>
          <div className="pb">
            <Step n={1} b="Fetch memory" s="From Postgres inside the enclave." />
            <Step n={2} b="Inclusion proof" s="Merkle path from the leaf to the current root." />
            <Step n={3} b="Set-completeness" s="Search returns a signed proof of the full result set." />
            <Step n={4} b="Attestation" s="Served with the TDX attestation + TEE public key." />
          </div>
        </div>
        <div className="panel pipe">
          <div className="ph cyan">Client verifies</div>
          <div className="pb">
            <Step n={1} b="TEE key" s="Matches the on-chain / dashboard attestation." />
            <Step n={2} b="Signature" s="Commitment signed by the attested key." />
            <Step n={3} b="Leaf binding" s="Content still hashes to its committed leaf." />
            <Step n={4} b="Inclusion" s="Leaf is under the signed root. All checks → trusted." />
          </div>
        </div>
      </div>
      <p className="note">
        On EigenCompute the signing key is sealed to the attested Docker image digest. Forging or editing a memory would
        require different code — a different digest — which <b>fails attestation</b>. That's the operator-can't-tamper
        guarantee, verifiable at <b>verify-sepolia.eigencloud.xyz</b>.
      </p>
    </section>
  );
}

function Step({ n, b, s }: { n: number; b: string; s: string }) {
  return (
    <div className="step">
      <span className="n">{n}</span>
      <div>
        <b>{b}</b>
        <span>{s}</span>
      </div>
    </div>
  );
}

const ROWS: [string, string, string][] = [
  ["store & recall (Mem0 API)", "yes", "yes"],
  ["who wrote it (provenance)", "no", "secp256k1 signature"],
  ["detect tampering / edits", "no", "Merkle leaf binding"],
  ["prove nothing was omitted", "no", "set-completeness proof"],
  ["deletions stay auditable", "no", "signed soft-delete"],
  ["operator can't tamper", "no", "Intel TDX + sealed key"],
];

export function Comparison() {
  return (
    <section className="section">
      <span className="kicker">Mem0 vs Verifiable Memory</span>
      <h2>A drop-in memory API — with cryptographic commitments baked in.</h2>
      <div className="panel">
        <div className="ph cyan">capability matrix</div>
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>Opaque memory DB</th>
              <th>Verifiable Memory</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([cap, a, b]) => (
              <tr key={cap}>
                <td className="feat">{cap}</td>
                <td className={a === "no" ? "no" : "yes"}>{a === "no" ? "✗ no" : "✓ yes"}</td>
                <td className="yes">✓ {b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const FEATURES = [
  ["Mem0-compatible API", "add / get / search / update / delete / history over a REST surface existing agent frameworks already expect."],
  ["secp256k1 commitments", "Every write is signed with the TEE wallet key — the same curve as Ethereum, with a derived 0x address."],
  ["Merkle inclusion proofs", "Append-only SHA-256 tree. Each read returns a path the client recomputes to the signed root."],
  ["Set-completeness proofs", "Search results carry a TEE-signed proof that no matching memory was selectively omitted."],
  ["Auditable soft-delete + TTL", "Deletions and expirations append signed DELETE commitments — removed from reads, never from history."],
  ["TDX attestation", "Image digest + KMS key fingerprint, verifiable on the EigenCloud Verifiability Dashboard."],
];

export function Features() {
  return (
    <section className="section" id="features">
      <span className="kicker">What you get</span>
      <h2>Everything needed to trust a memory you didn't write.</h2>
      <div className="grid g3">
        {FEATURES.map(([t, b]) => (
          <div className="fcard" key={t}>
            <h3>{t}</h3>
            <p>{b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const SNIPPETS: Record<string, string> = {
  library: `import { MemoryService, verifyMemory } from "verifiable-agent-memory";

const m = await svc.create({
  content: "User authorized $50/mo to Acme Corp",
  agentId: "billing-agent",
  tags: ["payment", "authorization"],
});

// read back with a Merkle proof, then verify locally
const read   = await svc.get(m.id);
const result = verifyMemory(read, read.teePublicKey);
result.ok;     // true
result.checks; // { teeKey, signature, leafBinding, inclusion, rootMatch }`,
  http: `# create (201) — hashed, secp256k1-signed, committed
curl -X POST $URL/v1/memories -H 'content-type: application/json' \\
  -d '{"content":"...","agentId":"billing-agent","tags":["payment"]}'

# read one memory WITH an inclusion proof + attestation
curl $URL/v1/memories/$ID

# search: each result has a proof + a set-completeness proof
curl "$URL/v1/memories?agentId=billing-agent&tags=payment"

# the signed Merkle root, and the TEE attestation
curl $URL/v1/tree/root
curl $URL/v1/attestation`,
  deploy: `# deploy into an Intel TDX enclave on EigenCompute
ecloud compute app create --name verifiable-memory --language typescript
ecloud compute app deploy        # "Build and deploy from Dockerfile"

# Node + PostgreSQL 16 co-located in one TEE container.
# The KMS seals the signing key to the attested image digest.
# verify at https://verify-sepolia.eigencloud.xyz`,
};

export function CodeTabs() {
  const [tab, setTab] = useState<keyof typeof SNIPPETS>("library");
  return (
    <section className="section" id="code">
      <span className="kicker">Quickstart</span>
      <h2>Drop it into your agent loop.</h2>
      <div className="panel codecard">
        <div className="tabs">
          {(Object.keys(SNIPPETS) as (keyof typeof SNIPPETS)[]).map((k) => (
            <button key={k} className={`tab${tab === k ? " active" : ""}`} onClick={() => setTab(k)}>
              {k}
            </button>
          ))}
        </div>
        <pre>{SNIPPETS[tab]}</pre>
      </div>
    </section>
  );
}

const FAQS: [string, string][] = [
  ["What stops an operator injecting false memories?", "Every committed memory is signed by the TEE-sealed secp256k1 key. An operator can write a row into Postgres, but it won't carry a valid signature or sit under the signed Merkle root — so verifyMemory rejects it."],
  ["How is tampering detected?", "The content hash is committed into the Merkle leaf. If stored content is edited, it no longer hashes to that leaf, and the inclusion proof fails. The original signed hash also stays in the append-only commitment log."],
  ["Why can't the operator just delete a memory?", "Deletes are soft and signed: a DELETE commitment is appended to the append-only tree and the row is flagged. History still proves the memory existed and when it was removed. The tree size only ever grows."],
  ["How does the TEE guarantee work?", "On EigenCompute the app runs in an Intel TDX enclave and the KMS releases the signing key only to the attested Docker image digest. Different code → different digest → failed attestation. Verify the digest at verify-sepolia.eigencloud.xyz."],
  ["Is this Mem0-compatible?", "The REST surface mirrors Mem0's add/search/get/delete/history, so existing agent frameworks adopt it with minimal changes — they just additionally get a proof with every read."],
];

export function FAQ() {
  return (
    <section className="section faq" id="faq">
      <span className="kicker">FAQ</span>
      <h2>Straight answers.</h2>
      <div className="panel">
        <div className="pb">
          {FAQS.map(([q, a]) => (
            <details className="qa" key={q}>
              <summary>
                <span className="q">Q.</span> {q}
              </summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function CTA() {
  return (
    <section className="section">
      <div className="panel cta">
        <span className="kicker">Part 3 of the Observability Series</span>
        <h2>
          Trace it. Verify it.
          <br />
          <span className="grad">Now prove what it remembers.</span>
        </h2>
        <div className="hero-cta" style={{ justifyContent: "center" }}>
          <a className="btn btn-primary" href={GH} target="_blank" rel="noreferrer">
            View on GitHub ★
          </a>
          <a className="btn btn-ghost" href="#demo">
            Replay the demo
          </a>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="legal">
      Verifiable Agent Memory · Observability Series Part 3 · EigenLabs · Intel TDX · EigenCompute · package{" "}
      <code>verifiable-agent-memory</code>
    </footer>
  );
}
