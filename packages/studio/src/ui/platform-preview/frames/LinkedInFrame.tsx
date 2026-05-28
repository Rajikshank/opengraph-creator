import { PlatformPreviewImage } from "../PlatformPreviewImage";
import type { PlatformFrameProps } from "../PreviewFrame";

export function LinkedInFrame({ projectName, svg }: PlatformFrameProps) {
  return (
    <article className="platform-frame linkedin-frame" aria-label="LinkedIn link post preview">
      <div className="social-post-header">
        <span className="social-avatar">in</span>
        <div>
          <strong>{projectName}</strong>
          <span>Company page · 1st</span>
        </div>
      </div>
      <p className="social-post-copy">A polished link preview for product updates, launches, and route-specific posts.</p>
      <div className="linkedin-card">
        <PlatformPreviewImage svg={svg} />
        <div className="link-meta">
          <strong>{projectName}</strong>
          <span>ogloom.local</span>
        </div>
      </div>
    </article>
  );
}
