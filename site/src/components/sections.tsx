import { useEffect, useState } from "react";

const GH = "https://github.com/zeeshan8281/chorus";

function Seal({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffa12a" />
          <stop offset="1" stopColor="#ff7a00" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="13" stroke="url(#g)" strokeWidth="2" />
      <path
        d="M16 7l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4-3.9-3.8 5.4-.8z"
        fill="url(#g)"
      />
    </svg>
  );
}

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <a className="brand glow" href="#top">
          <Seal /> VERIFIABLE&nbsp;MEMORY
        </a>
        <div className="nav-links">
          <a href="#why">Why</a>
          <a href="#how">How it works</a>
          <a href="#demo">Live demo</a>
          <a href="#code">Code</a>
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
  '<span class="d">»</span> agent <span class="c">assistant</span> → write user:42',
  '<span class="d">  gate……</span> <span class="ok">risk 0.00 · clean</span>',
  '<span class="d">  hash……</span> <span class="am">sha256 9f3c…a1</span>',
  '<span class="d">  commit…</span> <span class="ok">leaf #4 → root signed</span>',
  "&nbsp;",
  '<span class="d">»</span> agent <span class="bad">web-tool</span> → write',
  '<span class="d">  "ignore all previous instructions…"</span>',
  '<span class="bad">  gate…… risk 1.00</span> <span class="tagbad">BLOCKED</span>',
  '<span class="d">  ↳ never committed to the log</span>',
  "&nbsp;",
  '<span class="d">»</span> client → verify mem_04',
  '<span class="ok">  ✓ attestation ✓ root-sig ✓ leaf ✓ inclusion</span>',
  '<span class="am">  PROVEN · operator cannot have tampered</span>',
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
    <div className="panel feed">
      <div className="ph cyan">
        LIVE FEED · MEMORY BUS <span className="meta">user:42</span>
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
        <span className="eyebrow">VERIFIABLE AGENT MEMORY</span>
        <h1>
          Memory your agents
          <br />
          <span className="grad">can't be tricked into trusting.</span>
        </h1>
        <p className="sub">
          Persistent agent memory that <b>can't be poisoned or tampered with</b>. Every write is hashed,
          timestamped, and committed to a <b>signed Merkle log</b>; every read returns an <b>inclusion proof</b>.
          It runs inside an <b>Intel TDX TEE on EigenCompute</b> — so even the host operator can't forge, edit, or
          drop a memory, and any client can prove it.
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
          <code>npm i chorus</code>
          <span className="dim">· TypeScript · Node ≥ 22 · Intel TDX</span>
        </div>
      </div>
      <HeroFeed />
    </header>
  );
}

const THREATS = [
  {
    tag: "ASI06",
    title: "Memory injection",
    body: "Corrupt an agent's long-term beliefs once and you steer every future decision. A vector DB absorbs the poison silently.",
    stat: "80–95% attack success",
  },
  {
    tag: "INTEGRITY",
    title: "Silent tampering",
    body: "A malicious host can edit or delete a stored memory after the fact. Nothing proves what was originally written.",
    stat: "0 integrity checks",
  },
  {
    tag: "PROVENANCE",
    title: "No proof of origin",
    body: "You can't show a third party which code produced a memory, or that it wasn't fabricated by the operator.",
    stat: "unverifiable",
  },
];

export function Threats() {
  return (
    <section className="section" id="why">
      <span className="kicker">The threat</span>
      <h2>As agents gain memory, the memory becomes the attack surface.</h2>
      <p className="lead">
        Memory injection is a distinct 2026 attack class (OWASP ASI06; MINJA, AgentPoison). A plain store can't
        tell you who wrote a memory, whether it was edited, or that it was poisoned.
      </p>
      <div className="grid g3">
        {THREATS.map((t) => (
          <div className="tcard" key={t.title}>
            <div className="tcard-h">ALERT · {t.tag}</div>
            <h3>{t.title}</h3>
            <p>{t.body}</p>
            <div className="tstat">{t.stat}</div>
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
      <h2>Commit on write. Prove on read. Tamper-proof by construction.</h2>
      <div className="grid g3">
        <div className="panel pipe">
          <div className="ph">WRITE</div>
          <div className="pb">
            <Step n={1} b="Anti-injection gate" s="Override / exfiltration / system-spoof attempts are blocked — never committed." />
            <Step n={2} b="Hash + timestamp" s="The entry is sha256'd and stamped." />
            <Step n={3} b="Append to Merkle log" s="Its leaf joins an append-only tree." />
            <Step n={4} b="Sign the new root" s="The enclave's KMS-bound key signs the root." />
          </div>
        </div>
        <div className="panel pipe">
          <div className="ph">READ</div>
          <div className="pb">
            <Step n={1} b="Fetch entry" s="Scoped to its namespace." />
            <Step n={2} b="Inclusion proof" s="A Merkle path from the leaf to the signed root." />
            <Step n={3} b="Signed root" s="Plus the enclave's TDX attestation." />
            <Step n={4} b="Return all of it" s="Everything the client needs to verify offline." />
          </div>
        </div>
        <div className="panel pipe">
          <div className="ph cyan">CLIENT VERIFIES</div>
          <div className="pb">
            <Step n={1} b="Attestation" s="Image digest matches the EigenCompute dashboard." />
            <Step n={2} b="Root signature" s="Signed by the attested enclave key." />
            <Step n={3} b="Leaf binding" s="Entry still hashes to its committed leaf." />
            <Step n={4} b="Inclusion" s="Leaf is under that signed root. All four → trusted." />
          </div>
        </div>
      </div>
      <p className="note">
        The root-signing key only exists inside the attested image — so forging or editing a memory needs different
        code, which yields a different image digest and <b>fails attestation</b>. That's the operator-can't-tamper
        guarantee.
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
  ["recall the right memory", "yes", "yes"],
  ["who wrote it (provenance)", "no", "Ed25519-signed root"],
  ["detect tampering / edits", "no", "Merkle leaf binding"],
  ["block memory injection", "no", "gate before commit"],
  ["third-party verifiable", "no", "inclusion proofs"],
  ["operator can't tamper", "no", "TDX + KMS-bound key"],
];

export function Comparison() {
  return (
    <section className="section">
      <span className="kicker">Vector DB vs verifiable memory</span>
      <h2>Everyone else stores. This one proves.</h2>
      <div className="panel">
        <div className="ph cyan">CAPABILITY MATRIX</div>
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              <th>Plain memory / vector DB</th>
              <th>Verifiable Memory</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(([cap, a, b]) => (
              <tr key={cap}>
                <td className="feat">{cap}</td>
                <td className={a === "no" ? "no" : a === "yes" ? "yes" : "mid"}>
                  {a === "no" ? "✗ no" : a === "yes" ? "✓ yes" : a}
                </td>
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
  ["Anti-injection gate", "Blocks override / exfiltration / system-spoof writes before they're ever committed. Swap in an LLM gate."],
  ["Signed Merkle log", "Append-only, SHA-256. Each write commits a leaf and re-signs the root."],
  ["Inclusion proofs", "Every read carries a Merkle path the client recomputes — tamper-evident."],
  ["TEE-bound signer", "On EigenCompute the KMS releases the signing key only to the attested image digest."],
  ["Postgres in-enclave", "Encrypted, durable storage inside the TDX boundary; in-memory store for dev/tests."],
  ["Client verifyRead()", "One call, four checks. Refuses dev-mode keys in production."],
];

export function Features() {
  return (
    <section className="section" id="features">
      <span className="kicker">What you get</span>
      <h2>Everything needed to trust a memory you didn't write yourself.</h2>
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
  library: `import { VerifiableMemory, verifyRead } from "chorus";

const mem   = new VerifiableMemory();            // in TEE: keys from the KMS
const agent = await mem.registerAgent("assistant");

// write → hashed, committed to the signed Merkle log
const w = await mem.write(agent.id, {
  namespace: "user:42",
  key: "profile.role",
  content: "User is a backend engineer at Acme.",
});

// read back with a proof, then verify locally
const read   = await mem.readWithProof(w.entry.id);
const result = verifyRead(read, mem.attestation, expectedImageDigest);
result.ok;     // true
result.checks; // { attestation, rootSignature, inclusion, leafBinding }`,
  http: `# write — 201 committed, 422 blocked by the injection gate
curl -XPOST $URL/v1/memory -H "authorization: Bearer $KEY" \\
  -d '{"namespace":"user:42","key":"profile.role","content":"..."}'

# read one memory WITH an inclusion proof + attestation
curl "$URL/v1/memory/$ID" -H "authorization: Bearer $KEY"

# the enclave's attestation + current signed root
curl "$URL/v1/attestation"
curl "$URL/v1/root"`,
  deploy: `# deploy into an Intel TDX enclave on EigenCompute
ecloud auth login
ecloud deploy            # builds ./Dockerfile (linux/amd64) → TEE

# the KMS releases the signing key ONLY to the attested image digest;
# verify that digest on the EigenCompute Verifiability Dashboard.
# no TEE locally → dev mode (verifyRead refuses it in production)`,
};

export function CodeTabs() {
  const [tab, setTab] = useState<keyof typeof SNIPPETS>("library");
  return (
    <section className="section" id="code">
      <span className="kicker">Quickstart</span>
      <h2>Wrap your agent's memory in proofs.</h2>
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
  ["What exactly stops memory injection?", "A gate inspects every write for override / exfiltration / system-spoof patterns and refuses risky ones before they are committed to the log. The poisoned memory never enters the tree, so it can never be read back as trusted."],
  ["How can the operator be unable to tamper?", "On EigenCompute the service runs in an Intel TDX enclave and the KMS releases the root-signing key only to the exact attested Docker image digest. Editing a memory would need different code → a different digest → failed attestation. The signature can't be forged outside the enclave."],
  ["What does a client actually verify?", "verifyRead() runs four checks: the attestation's image digest matches the dashboard, the signed root came from the attested key, the entry still hashes to its committed leaf, and that leaf is included under the root. All four must pass."],
  ["Is the crypto real or a mockup?", "Real. The library uses Ed25519 + SHA-256 Merkle trees, and the live demo on this page computes genuine SHA-256 roots and inclusion proofs in your browser via Web Crypto."],
  ["Do I need a TEE to develop?", "No. Without one it runs in dev mode with an ephemeral key and attestation.mode = \"dev\" — which verifyRead refuses to trust in production. Deploy to EigenCompute for the real guarantee."],
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
        <span className="kicker">Don't just recall — prove.</span>
        <h2>
          Give your agents a memory
          <br />
          <span className="grad">nobody can forge.</span>
        </h2>
        <div className="hero-cta" style={{ justifyContent: "center" }}>
          <a className="btn btn-primary" href={GH} target="_blank" rel="noreferrer">
            Star on GitHub ★
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
      VERIFIABLE AGENT MEMORY · Intel TDX · EigenCompute · © 2026 · package <code>chorus</code> (name provisional)
    </footer>
  );
}
