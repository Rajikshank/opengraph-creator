# Platform Preview Research

GraphForge platform previews are platform-faithful simulators, not live platform screenshots. The exported OG image remains the source of truth; each preview frame shows how that image is likely to sit inside a social, chat, or metadata surface.

## Sources

- Open Graph protocol: `og:title`, `og:image`, `og:url`, image width, image height, type, and alt metadata.
- X Summary Card with Large Image: large-card image surface uses a 2:1 crop pressure.
- Slack link unfurling: Slack crawls fully qualified links and renders classic or app unfurls inside message surfaces.
- Discord message embeds: embeds expose title, description, provider, image, thumbnail, and color fields.
- LinkedIn Post Inspector: LinkedIn validates and refreshes URL preview image and metadata.

## Accuracy Rules

- Use exact OG output pixels for the image preview and keep the export target at 1200x630.
- Mark preview specs as `official` only when public docs define the relevant image or embed behavior.
- Mark client-only UI chrome as `client-observed` when the platform does not publish a stable visual spec.
- Keep platform frame dimensions stable so switching platforms does not shift the editor layout.
- Prefer one large active inspector frame over thumbnail grids.
- Test source rail open and closed states because the available stage width changes.

## Current Surface Decisions

- X: social feed frame with 2:1 image crop pressure and compact link metadata.
- Facebook: feed share frame with author row, text, image, and link metadata area.
- LinkedIn: professional feed frame with link attachment and title/domain metadata.
- Slack: desktop chat message with compact unfurl block.
- Discord: dark desktop embed with left accent rule and image field.
- WhatsApp: mobile chat bubble link card; treated as client-observed because the visual layout is not a stable public spec.
- iMessage: mobile rich-link bubble; treated as client-observed because the visual layout is device/client controlled.
- Browser/Search: debugger-style metadata preview for sanity checks.
