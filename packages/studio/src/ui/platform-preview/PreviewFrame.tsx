import type { CSSProperties } from "react";
import type { PlatformPreviewCard, PlatformPreviewSpec } from "../../platforms";
import { BrowserFrame } from "./frames/BrowserFrame";
import { DiscordFrame } from "./frames/DiscordFrame";
import { FacebookFrame } from "./frames/FacebookFrame";
import { IMessageFrame } from "./frames/IMessageFrame";
import { LinkedInFrame } from "./frames/LinkedInFrame";
import { SlackFrame } from "./frames/SlackFrame";
import { WhatsAppFrame } from "./frames/WhatsAppFrame";
import { XFrame } from "./frames/XFrame";

export interface PlatformFrameProps {
  card: PlatformPreviewCard;
  spec: PlatformPreviewSpec;
  projectName: string;
  svg: string;
}

export function PreviewFrame(props: PlatformFrameProps) {
  const { spec } = props;
  const style = {
    "--platform-frame-max": `${spec.frame.maxWidth}px`,
    "--platform-frame-min": `${spec.frame.minHeight}px`,
    "--platform-image-max": `${spec.frame.imageMaxWidth}px`
  } as CSSProperties;

  return (
    <div className={`platform-preview-inspector platform-preview-${spec.id}`} style={style}>
      <div className={`platform-preview-device platform-surface-${spec.surface}`}>
        {renderFrame(props)}
      </div>
    </div>
  );
}

function renderFrame(props: PlatformFrameProps) {
  if (props.spec.componentName === "XFrame") return <XFrame {...props} />;
  if (props.spec.componentName === "LinkedInFrame") return <LinkedInFrame {...props} />;
  if (props.spec.componentName === "FacebookFrame") return <FacebookFrame {...props} />;
  if (props.spec.componentName === "DiscordFrame") return <DiscordFrame {...props} />;
  if (props.spec.componentName === "SlackFrame") return <SlackFrame {...props} />;
  if (props.spec.componentName === "WhatsAppFrame") return <WhatsAppFrame {...props} />;
  if (props.spec.componentName === "IMessageFrame") return <IMessageFrame {...props} />;
  return <BrowserFrame {...props} />;
}
