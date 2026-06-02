# OpenGraph Creator

OpenGraph Creator is an agent-first Open Graph image studio and CLI for app repositories.

Coding agents such as Codex, Claude Code, and OpenCode generate editable `.ogdoc` documents. OpenGraph Creator Studio opens those documents, lets users edit visually, previews platform crops, exports optimized `1200x630` assets, and writes handoff files so the agent can wire metadata into the target app after confirmation.

OpenGraph Creator does not call OpenAI, Anthropic, or image-generation providers directly. Generation belongs to the coding agent; Studio owns editing, preview, export, compression, recovery, and handoff.

## Install Skill

Install the public skill with the skills CLI. The skill is shared by Codex, Claude Code, and OpenCode; the `--agent` option only controls where the skills CLI installs it.

### Install For All Supported Agents

Use this when you want every supported local coding agent to receive the skill:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent "*" -y
```

`--agent "*"` targets every supported detected agent. It is the public all-agent install path.

### Install For One Agent

Use one of these when you only want a specific coding agent to receive the skill:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent codex -y
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent claude-code -y
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent opencode -y
```

### Install For Selected Agents

Repeat `--agent`, or use its short alias `-a`, when installing to more than one specific agent:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator -a codex -a opencode -y
```

## Verify Runtime

The skill delegates Studio and export work to the npm runtime. Verify the runtime after installing or updating the skill:

```bash
npx -y opengraph-creator@latest doctor --json
```

The doctor should report that no provider API key is required and that the agent skill is installed in at least one known skills directory.

## Run Studio

Open Studio directly from an app repo:

```bash
npx -y opengraph-creator@latest studio --repo .
```

Manual launch opens the Project Hub. Agent launch opens the generated session document directly.

## Agent Workflow

After the skill is installed, open your app in Codex, Claude Code, or OpenCode and ask for an editable Open Graph image.

The installed skill should:

1. Inspect the app routes, brand assets, copy, screenshots, and existing metadata.
2. Ask only the relevant design questions.
3. Create a durable `.opengraph-creator/sessions/<id>/` session.
4. Generate an editable layered `.ogdoc` document.
5. Launch Studio with that document.
6. Wait for Studio to request a revision, publish, cancel, or restart.
7. Wire metadata only after the user confirms publish.

## Session Handoff Files

OpenGraph Creator uses a local file bridge so agents and Studio can resume safely:

```text
.opengraph-creator/sessions/<id>/
  session.json
  events.jsonl
  document.ogdoc
  incoming/
  export.json
  publish-request.json
  agent-request.json
  studio.json
```

Treat these files as recovery state. Preview requests are review state only; metadata should be changed only after a confirmed publish request.

## Update Skill And Runtime

Update installed skills through the skills CLI:

```bash
npx skills check
npx skills update
```

Use the latest Studio runtime through npm:

```bash
npx -y opengraph-creator@latest doctor --json
```

Skill updates and runtime updates are separate. The skill tells the coding agent what to do; the npm runtime launches Studio, validates `.ogdoc` documents, exports images, and writes handoff files.

## Troubleshooting

If the skill cannot find the runtime, verify the npm runtime:

```bash
npx -y opengraph-creator@latest doctor --json
```

If the skill is missing for one agent, prefer reinstalling through the skills CLI:

```bash
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent codex -y
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent claude-code -y
npx skills add -g Rajikshank/opengraph-creator --skill opengraph-creator --agent opencode -y
```

`opengraph-creator install-skill` is a fallback repair command for local development or recovery only. It uses `--agent all` instead of `--agent "*"`:

```bash
opengraph-creator install-skill --agent codex --scope global
opengraph-creator install-skill --agent claude-code --scope global
opengraph-creator install-skill --agent opencode --scope global
opengraph-creator install-skill --agent all --scope global
```

Normal users should install through `npx skills add`, not by cloning or building this repository.

## Repository

Full documentation and source:

https://github.com/Rajikshank/opengraph-creator
