# Agent Handoff

OpenGraph Creator handoff files live at `.opengraph-creator/agent-handoff.json`.

Use handoff when Studio or the CLI needs Codex, Claude, or OpenCode to generate or revise an OG artifact. The handoff should include:

- current `.ogdoc` document package
- editable `document.json` inside the package when a text/layer revision is needed
- selected strategy and page
- prompt/request from the user
- source artifact paths
- expected output path
- expected dimensions: 1200x630
- accepted output types: OpenGraph Creator project JSON, SVG, HTML, PNG, WebP, JPEG
- acceptance criteria for safe-zone, readability, and export readiness
- default accepted source type: `.ogdoc` with editable text and object layers

After the coding agent creates the artifact, import it with:

```bash
opengraph-creator import --source "<artifact>" --kind project-json|svg|html|image --name "<app>" --out ".opengraph-creator/<app>.ogdoc"
```

For session work, write the document package to `.opengraph-creator/sessions/<id>/document.ogdoc`, launch Studio with `opengraph-creator session launch --repo "<repo>" --id "<id>" --open true --waitReady true --json`, and keep waiting with `opengraph-creator session wait --repo "<repo>" --id "<id>" --until next-action --timeout 0` until Studio records a confirmed publish handoff, an agent revision request, a cancel, or an explicit user stop instruction. Preview requests are not final publish approval.
