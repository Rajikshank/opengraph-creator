export function PlatformPreviewImage({ svg, className = "" }: { svg: string; className?: string }) {
  return (
    <div className={`platform-preview-image-slot ${className}`.trim()}>
      <div className="preview-image-large" dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}
