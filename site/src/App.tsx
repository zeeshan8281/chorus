import LiveDemo from "./components/LiveDemo";
import {
  CTA,
  CodeTabs,
  Comparison,
  FAQ,
  Features,
  Footer,
  Hero,
  HowItWorks,
  Nav,
  Threats,
} from "./components/sections";

export default function App() {
  return (
    <>
      <Nav />
      <main className="wrap">
        <Hero />
        <Threats />
        <HowItWorks />
        <section className="section" id="demo">
          <span className="kicker">Receipts, for real</span>
          <h2>Write a memory. Poison one. Tamper with one. Watch the proofs hold.</h2>
          <p className="lead">
            This panel computes genuine SHA-256 Merkle roots and inclusion proofs in your browser — the same scheme
            the library uses. Tamper with a committed entry and verification breaks exactly where it should.
          </p>
          <LiveDemo />
        </section>
        <Comparison />
        <Features />
        <CodeTabs />
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
