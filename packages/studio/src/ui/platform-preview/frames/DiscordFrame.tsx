import { PlatformPreviewImage } from "../PlatformPreviewImage";
import type { PlatformFrameProps } from "../PreviewFrame";

export function DiscordFrame({ projectName, svg }: PlatformFrameProps) {
  return (
    <article className="platform-frame discord-frame" aria-label="Discord embed preview">
      <div className="chat-message-row">
        <span className="chat-avatar discord-avatar">O</span>
        <div className="chat-message-body">
          <div className="chat-author-line">
            <strong>Ogloom Bot</strong>
            <span>Today at 10:24 AM</span>
          </div>
          <div className="discord-embed">
            <div className="embed-rule" />
            <div className="embed-body">
              <strong>{projectName}</strong>
              <span>Editable Open Graph source ready for publish.</span>
              <PlatformPreviewImage svg={svg} className="platform-image-compact" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
