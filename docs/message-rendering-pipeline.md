# Unified message rendering pipeline

All chat surfaces use the same logical message model. OneBot, Web LLM, server
Agent, and SubAgent transports may produce different wire frames, but they must
not mutate `contactor.messageChain` directly.

## Ingress

Transport and UI adapters dispatch events through
`contactorsStore.applyMessageEvent()`:

- `message.upsert`: optimistic messages and channel/OneBot message snapshots
- `message.patch`: explicit local state transitions such as upload and retry
- `message.chunk`: incremental reason, text, and tool-call data
- `message.snapshot`: authoritative StreamingCache replay
- `message.complete` / `message.failed`: terminal transitions
- `message.usage` / `message.crystallize`: attached stream data
- `history.reconcile`: persisted history baseline or older-page merge
- `message.rekey` / `message.remove`: identity and lifecycle operations

`gateway.js` is a protocol adapter only. Batching in `StreamBuffer` reduces Vue
render pressure, then emits `message.chunk`; it never writes the array itself.

## Identity

`message.id` identifies one logical message across optimistic rendering,
Socket.IO live frames, StreamingCache replay, database persistence, and history.
The backend allocates or accepts the ID once and persists that exact value.
History must return the database ID rather than inventing a display ID.

## Merge rules

The pure merge rules live in `src/lib/messageState.js`.

1. Equal IDs are merged in place to preserve Vue object identity.
2. A stale active snapshot cannot roll a completed or failed message backward.
3. Persisted history cannot erase a longer in-flight stream.
4. Initial history replaces only the persisted baseline. Local in-flight and
   system messages survive until the corresponding persisted ID appears.
5. Pagination prepends only IDs not already present.
6. Late chunks for a terminal message are rejected.
7. Empty terminal cache snapshots cannot erase already rendered content.

## Source of truth

While a message is active, Socket.IO and StreamingCache are the source of truth
for every Agent type. Persisted history is a reconciliation baseline, not a
second renderer. After completion, Web-only conversations may remain in browser
storage while server Agent and SubAgent history comes from the backend; both are
still reduced into the same frontend state.

The client acknowledges a completed StreamingCache record only after the
accepted state has been saved. Reconnect replay is therefore safe and
idempotent.
