import type { ImageLayer, OgLayer, ShapeLayer, TextLayer } from "@graphforge/core";
import { Crosshair, Maximize2, Scan, SlidersHorizontal, Upload } from "lucide-react";
import { StudioSelect } from "../design-system/StudioSelect";
import { StudioSlider } from "../design-system/StudioSlider";
import { useStudio } from "./studio-store";

export function InspectorPanel() {
  const project = useStudio((state) => state.project);
  const selectedLayerId = useStudio((state) => state.selectedLayerId);
  const updateLayer = useStudio((state) => state.updateLayer);
  const resizeSelected = useStudio((state) => state.resizeSelected);
  const snapLayer = useStudio((state) => state.snapLayer);
  const layer = project?.layers.find((item) => item.id === selectedLayerId) ?? project?.layers[0];
  if (!layer) return null;

  return (
    <section className="studio-section">
      <h2 className="section-heading">
        <SlidersHorizontal size={15} />
        <span>Inspector</span>
      </h2>
      <label>
        Layer name
        <input value={layer.name} onChange={(event) => updateLayer(layer.id, { name: event.target.value } as Partial<OgLayer>)} />
      </label>
      <div className="grid-two">
        <label>X<input type="number" value={Math.round(layer.x)} onChange={(event) => updateLayer(layer.id, { x: Number(event.target.value) } as Partial<OgLayer>)} /></label>
        <label>Y<input type="number" value={Math.round(layer.y)} onChange={(event) => updateLayer(layer.id, { y: Number(event.target.value) } as Partial<OgLayer>)} /></label>
        <label>Width<input type="number" value={Math.round(layer.width)} onChange={(event) => resizeSelected({ width: Number(event.target.value), height: layer.height })} /></label>
        <label>Height<input type="number" value={Math.round(layer.height)} onChange={(event) => resizeSelected({ width: layer.width, height: Number(event.target.value) })} /></label>
      </div>
      <StudioSlider label="Opacity" min={0} max={1} step={0.05} value={layer.opacity} onValueChange={(value) => updateLayer(layer.id, { opacity: value } as Partial<OgLayer>)} />
      <label>
        Skew/tilt
        <input type="number" value={layer.skewX ?? 0} onChange={(event) => updateLayer(layer.id, { skewX: Number(event.target.value) } as Partial<OgLayer>)} />
      </label>
      <div className="arrange-tools" aria-label="Snap selected layer">
        <button type="button" title="Snap to safe zone" onClick={() => snapLayer(layer.id, "safe-zone")}>
          <Scan size={14} />
        </button>
        <button type="button" title="Snap to canvas center" onClick={() => snapLayer(layer.id, "canvas-center")}>
          <Crosshair size={14} />
        </button>
        <button type="button" title="Snap to top left" onClick={() => snapLayer(layer.id, "canvas-top-left")}>
          <Maximize2 size={14} />
        </button>
        <button type="button" title="Snap to bottom right" onClick={() => snapLayer(layer.id, "canvas-bottom-right")}>
          <Maximize2 size={14} className="rotate-icon" />
        </button>
      </div>
      {isTextLayer(layer) ? <TextControls layer={layer} /> : null}
      {isShapeLayer(layer) ? <ShapeControls layer={layer} /> : null}
      {isImageLayer(layer) ? <ImageControls layer={layer} /> : null}
    </section>
  );
}

function TextControls({ layer }: { layer: TextLayer }) {
  const updateLayer = useStudio((state) => state.updateLayer);
  return (
    <>
      <label>Text<textarea value={layer.text} onChange={(event) => updateLayer(layer.id, { text: event.target.value } as Partial<OgLayer>)} /></label>
      <div className="grid-two">
        <label>Font<input value={layer.fontFamily} onChange={(event) => updateLayer(layer.id, { fontFamily: event.target.value } as Partial<OgLayer>)} /></label>
        <label>Size<input type="number" value={layer.fontSize} onChange={(event) => updateLayer(layer.id, { fontSize: Number(event.target.value) } as Partial<OgLayer>)} /></label>
        <label>Weight<input type="number" step="100" value={layer.fontWeight} onChange={(event) => updateLayer(layer.id, { fontWeight: Number(event.target.value) } as Partial<OgLayer>)} /></label>
        <StudioSelect
          label="Style"
          value={layer.fontStyle ?? "normal"}
          options={[
            { value: "normal", label: "Normal" },
            { value: "italic", label: "Italic" }
          ]}
          onValueChange={(value) => updateLayer(layer.id, { fontStyle: value as TextLayer["fontStyle"] } as Partial<OgLayer>)}
        />
        <label>Color<input type="color" value={layer.color} onChange={(event) => updateLayer(layer.id, { color: event.target.value } as Partial<OgLayer>)} /></label>
        <label>Line height<input type="number" min="0.8" max="2" step="0.05" value={layer.lineHeight} onChange={(event) => updateLayer(layer.id, { lineHeight: Number(event.target.value) } as Partial<OgLayer>)} /></label>
        <label>Letter spacing<input type="number" value={layer.letterSpacing ?? 0} onChange={(event) => updateLayer(layer.id, { letterSpacing: Number(event.target.value) } as Partial<OgLayer>)} /></label>
        <label>Stroke<input type="color" value={layer.stroke ?? "#171918"} onChange={(event) => updateLayer(layer.id, { stroke: event.target.value } as Partial<OgLayer>)} /></label>
        <label>Stroke width<input type="number" value={layer.strokeWidth ?? 0} onChange={(event) => updateLayer(layer.id, { strokeWidth: Number(event.target.value) } as Partial<OgLayer>)} /></label>
      </div>
    </>
  );
}

function ShapeControls({ layer }: { layer: ShapeLayer }) {
  const updateLayer = useStudio((state) => state.updateLayer);
  return (
    <div className="grid-two">
      <label>Fill<input type="color" value={extractHex(layer.fill)} onChange={(event) => updateLayer(layer.id, { fill: event.target.value } as Partial<OgLayer>)} /></label>
      {layer.shapeType !== "ellipse" && layer.shapeType !== "line" ? <label>Radius<input type="number" value={layer.radius} onChange={(event) => updateLayer(layer.id, { radius: Number(event.target.value) } as Partial<OgLayer>)} /></label> : null}
      <label>Stroke<input type="color" value={layer.stroke ?? "#c9cec7"} onChange={(event) => updateLayer(layer.id, { stroke: event.target.value } as Partial<OgLayer>)} /></label>
      <label>Stroke width<input type="number" value={layer.strokeWidth ?? 0} onChange={(event) => updateLayer(layer.id, { strokeWidth: Number(event.target.value) } as Partial<OgLayer>)} /></label>
    </div>
  );
}

function ImageControls({ layer }: { layer: ImageLayer }) {
  const updateLayer = useStudio((state) => state.updateLayer);
  const setImageCrop = useStudio((state) => state.setImageCrop);
  const setImageFocalPoint = useStudio((state) => state.setImageFocalPoint);
  const setImagePerspective = useStudio((state) => state.setImagePerspective);
  const crop = layer.crop ?? { x: 0, y: 0, width: 1, height: 1 };
  const focalPoint = layer.focalPoint ?? { x: 0.5, y: 0.5 };
  const perspective = normalizePerspective(layer.perspective);
  return (
    <>
      <label>Source<input value={layer.src} onChange={(event) => updateLayer(layer.id, { src: event.target.value } as Partial<OgLayer>)} /></label>
      <label className="file-upload-control">
        <span>
          <Upload size={14} />
          Image file
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            updateLayer(layer.id, { src: await readFileAsDataUrl(file), name: file.name } as Partial<OgLayer>);
            event.currentTarget.value = "";
          }}
        />
      </label>
      <div className="grid-two">
        <StudioSelect
          label="Fit"
          value={layer.fit}
          options={[
            { value: "cover", label: "Cover" },
            { value: "contain", label: "Contain" },
            { value: "fill", label: "Fill" }
          ]}
          onValueChange={(value) => updateLayer(layer.id, { fit: value as ImageLayer["fit"] } as Partial<OgLayer>)}
        />
        <label>Focal X<input type="number" min="0" max="1" step="0.05" value={focalPoint.x} onChange={(event) => setImageFocalPoint(layer.id, { x: Number(event.target.value), y: focalPoint.y })} /></label>
        <label>Focal Y<input type="number" min="0" max="1" step="0.05" value={focalPoint.y} onChange={(event) => setImageFocalPoint(layer.id, { x: focalPoint.x, y: Number(event.target.value) })} /></label>
        <label>Crop X<input type="number" min="0" max="1" step="0.05" value={crop.x} onChange={(event) => setImageCrop(layer.id, { ...crop, x: Number(event.target.value) })} /></label>
        <label>Crop Y<input type="number" min="0" max="1" step="0.05" value={crop.y} onChange={(event) => setImageCrop(layer.id, { ...crop, y: Number(event.target.value) })} /></label>
        <label>Crop W<input type="number" min="0" max="1" step="0.05" value={crop.width} onChange={(event) => setImageCrop(layer.id, { ...crop, width: Number(event.target.value) })} /></label>
        <label>Crop H<input type="number" min="0" max="1" step="0.05" value={crop.height} onChange={(event) => setImageCrop(layer.id, { ...crop, height: Number(event.target.value) })} /></label>
      </div>
      <div className="perspective-grid">
        {perspective.map((point, index) => (
          <fieldset key={index}>
            <legend>{["TL", "TR", "BR", "BL"][index]}</legend>
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={point.x}
              onChange={(event) => setImagePerspective(layer.id, perspective.map((item, itemIndex) => itemIndex === index ? { ...item, x: Number(event.target.value) } : item))}
            />
            <input
              type="number"
              min="0"
              max="1"
              step="0.05"
              value={point.y}
              onChange={(event) => setImagePerspective(layer.id, perspective.map((item, itemIndex) => itemIndex === index ? { ...item, y: Number(event.target.value) } : item))}
            />
          </fieldset>
        ))}
      </div>
    </>
  );
}

function isTextLayer(layer: OgLayer): layer is TextLayer {
  return layer.kind === "text" || layer.kind === "badge";
}
function isShapeLayer(layer: OgLayer): layer is ShapeLayer {
  return layer.kind === "shape" || layer.kind === "background";
}
function isImageLayer(layer: OgLayer): layer is ImageLayer {
  return layer.kind === "image" || layer.kind === "logo" || layer.kind === "screenshot";
}
function extractHex(value: string): string {
  return value.match(/#[0-9a-fA-F]{6}/)?.[0] ?? "#ffffff";
}

function normalizePerspective(perspective: ImageLayer["perspective"]): NonNullable<ImageLayer["perspective"]> {
  return perspective?.length === 4
    ? perspective
    : [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 }
      ];
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Image upload failed.")));
    reader.readAsDataURL(file);
  });
}
