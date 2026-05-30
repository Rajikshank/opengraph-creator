# Workflow Reference

Use this when the agent needs the exact OpenGraph Creator loop.

1. Inspect the repo for framework, routes, metadata, brand assets, screenshots, copy, and existing OG images.
2. Stop at the Question Gate until the user answers the relevant design and coverage questions.
3. Run reference research and write a style thesis from local evidence and allowed references.
4. Create a durable session with `opengraph-creator session create`.
5. Generate an editable `.ogdoc` master document at `.opengraph-creator/sessions/<id>/document.ogdoc`.
6. Validate with `opengraph-creator document validate --source ".opengraph-creator/sessions/<id>/document.ogdoc"`.
7. Launch Studio with `opengraph-creator session launch --repo "<repo>" --id "<id>" --open true --waitReady true --json`.
8. Wait with `opengraph-creator session wait --repo "<repo>" --id "<id>" --until next-action --timeout 0`.
9. If Studio requests revision or restart, update the same session document, validate, relaunch, and wait again.
10. If Studio confirms publish, read `publish-request.json`, preview metadata changes, and wire them only after explicit confirmation.
