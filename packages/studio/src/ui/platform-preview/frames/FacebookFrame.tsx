import { PlatformPreviewImage } from "../PlatformPreviewImage";
import type { PlatformFrameProps } from "../PreviewFrame";

export function FacebookFrame({ projectName, svg }: PlatformFrameProps) {
  return (
    <article className="platform-frame facebook-frame" aria-label="Facebook feed share preview">
      <div className="social-post-header">
        <span className="social-avatar">f</span>
        <div>
          <strong>{projectName}</strong>
          <span>Sponsored · Public</span>
        </div>
      </div>
      <p className="social-post-copy">A clean launch card for the page people will share first.</p>
      <PlatformPreviewImage svg={svg} />
      <div className="link-meta facebook-link-meta">
        <span>OGLOOM.LOCAL</span>
        <strong>{projectName}</strong>
      </div>
    </article>
  );
}
