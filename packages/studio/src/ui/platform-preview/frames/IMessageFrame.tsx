import { PlatformPreviewImage } from "../PlatformPreviewImage";
import type { PlatformFrameProps } from "../PreviewFrame";

export function IMessageFrame({ projectName, svg }: PlatformFrameProps) {
  return (
    <article className="platform-frame mobile-frame imessage-frame" aria-label="iMessage rich link preview">
      <div className="mobile-statusbar">
        <span>Messages</span>
        <small>10:24</small>
      </div>
      <div className="mobile-chat-thread imessage-thread">
        <div className="imessage-bubble">
          <PlatformPreviewImage svg={svg} className="platform-image-mobile" />
          <div className="message-meta">
            <strong>{projectName}</strong>
            <span>ogloom.local</span>
          </div>
        </div>
      </div>
    </article>
  );
}
