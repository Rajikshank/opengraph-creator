import { PlatformPreviewImage } from "../PlatformPreviewImage";
import type { PlatformFrameProps } from "../PreviewFrame";

export function XFrame({ projectName, svg }: PlatformFrameProps) {
  return (
    <article className="platform-frame x-frame" aria-label="X large summary card preview">
      <div className="social-post-header">
        <span className="social-avatar">X</span>
        <div>
          <strong>Product team</strong>
          <span>@app · now</span>
        </div>
      </div>
      <p className="social-post-copy">Shipping a sharper preview for {projectName}.</p>
      <div className="x-card">
        <PlatformPreviewImage svg={svg} className="platform-image-wide" />
        <div className="link-meta">
          <strong>{projectName}</strong>
          <span>ogloom.local</span>
        </div>
      </div>
    </article>
  );
}
