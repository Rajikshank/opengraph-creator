# Metadata Apply

Always preview before applying metadata.

Preview:

```bash
opengraph-creator apply --repo "<repo>" --framework next|astro|nuxt|remix|vite|html --image "public/og.png"
```

Confirmed apply:

```bash
opengraph-creator apply --repo "<repo>" --framework next|astro|nuxt|remix|vite|html --image "public/og.png" --confirm
```

Rules:

- Ask the user before confirmed apply.
- Preserve backups.
- Upsert social tags instead of replacing whole files.
- If metadata is dynamic or complex, provide snippets and ask for review instead of blind mutation.
- Apply common images to `public/og.*`.
- Apply page-specific images to `public/og/<route>.*`.
