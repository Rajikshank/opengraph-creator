# Recovery Reference

Recover from the durable session folder before starting over.

Important files:

- `.opengraph-creator/sessions/<id>/session.json`
- `.opengraph-creator/sessions/<id>/events.jsonl`
- `.opengraph-creator/sessions/<id>/document.ogdoc`
- `.opengraph-creator/sessions/<id>/generation-brief.json`
- `.opengraph-creator/sessions/<id>/export.json`
- `.opengraph-creator/sessions/<id>/agent-request.json`
- `.opengraph-creator/sessions/<id>/publish-request.json`

If the CLI cannot be found, run `node scripts/ensure-opengraph-creator.mjs`. If that fails, ask the user to verify Node/npm availability and retry the skills install. Do not clone/build the full Studio repo as the normal recovery path.
