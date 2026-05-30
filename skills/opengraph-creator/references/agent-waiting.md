# Agent Waiting And Recovery

The cross-agent contract is durable files plus explicit wait targets. Do not depend on every coding agent having native hooks that can force it to stay alive.

Use this wait command after Studio opens:

```bash
opengraph-creator session wait --repo "<repo>" --id "<id>" --until next-action --timeout 0
```

Expected next-action states:

- `agent-requested`: inspect `session.json.pendingAction`.
- `agent-restart-from-question-gate`: keep the same session alive, ask the Question Gate again, generate a fresh editable `.ogdoc`, validate it, relaunch Studio, then wait for `next-action` again. Restart is not terminal.
- `agent-revise-document`: read `agent-request.json`, update `.opengraph-creator/sessions/<id>/document.ogdoc`, validate it, relaunch Studio, then wait for `next-action` again.
- `published`: read `publish-request.json`, confirm it has `"status": "confirmed"`, then wire metadata or run the framework-specific publish/apply step.
- `cancelled` or `terminal`: stop without mutating app metadata.

If the agent is interrupted, recover from `.opengraph-creator/sessions/<id>/session.json`, `events.jsonl`, `document.ogdoc`, `export.json`, `publish-request.json`, and `agent-request.json`. Preview publish requests are only review state; they are not approval to mutate app metadata.

`--until publish-confirmed` exists for older or narrow flows, but `--until next-action` is the default because it works for user revision requests as well as confirmed publish handoffs.

Agent-specific hardening is optional. Claude Code may support stop hooks that prevent early exit, but Codex and OpenCode should be treated as durable-file wait/resume clients for v1 correctness.
