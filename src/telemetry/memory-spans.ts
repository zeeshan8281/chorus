import { trace, SpanStatusCode, type Attributes } from "@opentelemetry/api";

/**
 * Part 1 integration (Eigen Trace Mirror): every memory operation runs inside
 * an OTel span. With no exporter configured this is the API's no-op tracer, so
 * it's free in dev; in production the spans flow to a Trace Mirror that signs
 * them — giving a dual-signed audit trail (memory commitment + telemetry).
 */
const tracer = trace.getTracer("verifiable-agent-memory", "0.1.0");

export async function withMemorySpan<T>(
  name: string,
  attributes: Attributes,
  fn: () => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}

/** Annotate the active span with the commitment produced by an operation. */
export function annotateCommitment(attrs: { memoryId: string; contentHash: string; merkleRoot: string; signature: string }) {
  const span = trace.getActiveSpan();
  if (!span) return;
  span.setAttribute("memory.id", attrs.memoryId);
  span.setAttribute("memory.content_hash", attrs.contentHash);
  span.setAttribute("memory.merkle_root", attrs.merkleRoot);
  span.setAttribute("memory.signature", attrs.signature);
}
