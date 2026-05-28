import { PlatformPreviewImage } from "../PlatformPreviewImage";
import type { PlatformFrameProps } from "../PreviewFrame";

export function WhatsAppFrame({ projectName, svg }: PlatformFrameProps) {
  return (
    <article className="platform-frame mobile-frame whatsapp-frame" aria-label="WhatsApp link preview">
      <div className="mobile-statusbar whatsapp-bar">
        <span>WhatsApp</span>
        <small>10:24</small>
      </div>
      <div className="mobile-chat-thread whatsapp-thread">
        <div className="whatsapp-bubble">
          <div className="mobile-link-card">
            <PlatformPreviewImage svg={svg} className="platform-image-mobile" />
            <div className="message-meta">
              <strong>{projectName}</strong>
              <span>ogloom.local</span>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
