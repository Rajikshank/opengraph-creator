import { PlatformPreviewImage } from "../PlatformPreviewImage";
import type { PlatformFrameProps } from "../PreviewFrame";

export function BrowserFrame({ projectName, svg }: PlatformFrameProps) {
  return (
    <article className="platform-frame browser-frame" aria-label="Browser metadata preview">
      <div className="browser-bar">
        <span />
        <span />
        <span />
        <strong>Open Graph Debugger</strong>
      </div>
      <div className="browser-result">
        <PlatformPreviewImage svg={svg} className="platform-image-debug" />
        <div className="link-meta">
          <span>og:image · 1200x630</span>
          <strong>{projectName}</strong>
          <small>ogloom.local</small>
        </div>
      </div>
    </article>
  );
}
