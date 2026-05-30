import { PlatformPreviewImage } from "../PlatformPreviewImage";
import type { PlatformFrameProps } from "../PreviewFrame";

export function SlackFrame({ projectName, svg }: PlatformFrameProps) {
  return (
    <article className="platform-frame slack-frame" aria-label="Slack unfurl preview">
      <div className="chat-message-row">
        <span className="chat-avatar slack-avatar">GF</span>
        <div className="chat-message-body">
          <div className="chat-author-line">
            <strong>opengraph-creator</strong>
            <span>10:24 AM</span>
          </div>
          <p>Previewing https://opengraph.local</p>
          <div className="slack-unfurl">
            <div className="embed-rule" />
            <div className="embed-body">
              <span>opengraph.local</span>
              <strong>{projectName}</strong>
              <PlatformPreviewImage svg={svg} className="platform-image-compact" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
