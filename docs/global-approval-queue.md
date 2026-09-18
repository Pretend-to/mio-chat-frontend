# Global approval queue

Human approval is application control-plane state. It is not a chat message and
does not belong to the lifecycle of `ChatView`, `InputEditor`, or the currently
selected Agent.

`GlobalInteractionQueue.vue` is mounted once by `App.vue`. Socket action frames
from every Agent and SubAgent enter `interactionStore`, where they are
deduplicated by request and interaction ID. The selected conversation only
provides source metadata; it never filters, consumes, or hides the queue.

An item leaves the queue only when:

- the server acknowledges the submitted decision;
- the server emits a terminal interaction-only frame for its request; or
- the backend expires the approval and broadcasts failure.

Route changes and component unmounts must never clear pending approvals. On
login and reconnect, the backend approval broker replays all unresolved
SubAgent approvals to administrators. Normal Agent approvals are restored from
their active StreamCache records.

The **Trust this Agent** action is session-scoped. The approval frame carries
both the owning Agent ID and the actual execution Session ID; for SubAgents the
child Session is used rather than the parent delivery stream. The frontend
enables that Session's persisted YOLO state first and only then approves the
current operation. If enabling YOLO fails, the approval remains in the queue.
