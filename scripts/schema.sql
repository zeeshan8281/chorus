-- Verifiable Agent Memory — PostgreSQL schema (runs inside the TEE).

CREATE TABLE IF NOT EXISTS memories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id        TEXT NOT NULL,
    content         TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    tags            TEXT[] NOT NULL DEFAULT '{}',
    content_hash    BYTEA NOT NULL,
    signature       BYTEA NOT NULL,
    merkle_leaf_idx BIGINT NOT NULL,
    merkle_root     BYTEA NOT NULL,
    version         INTEGER NOT NULL DEFAULT 1,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_agent_deleted ON memories(agent_id, is_deleted);

-- Sparse Merkle tree storage. Leaves are level 0; upper levels recomputed.
CREATE TABLE IF NOT EXISTS merkle_nodes (
    level       INTEGER NOT NULL,
    idx         BIGINT NOT NULL,
    hash        BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (level, idx)
);

-- Append-only audit trail of every commitment.
CREATE TABLE IF NOT EXISTS commitment_log (
    id              BIGSERIAL PRIMARY KEY,
    operation       TEXT NOT NULL,
    memory_id       UUID NOT NULL,
    content_hash    BYTEA NOT NULL,
    signature       BYTEA NOT NULL,
    merkle_root     BYTEA NOT NULL,
    merkle_leaf_idx BIGINT NOT NULL,
    prev_root       BYTEA,
    timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Version history (each UPDATE archives the prior version).
CREATE TABLE IF NOT EXISTS memory_versions (
    id              BIGSERIAL PRIMARY KEY,
    memory_id       UUID NOT NULL,
    version         INTEGER NOT NULL,
    content         TEXT NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    content_hash    BYTEA NOT NULL,
    signature       BYTEA NOT NULL,
    merkle_leaf_idx BIGINT NOT NULL,
    merkle_root     BYTEA NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
