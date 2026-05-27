import { Circle, ImagePlus, Minus, Square, Type } from "lucide-react";
import { useStudio } from "./studio-store";

export function ToolPalette() {
  const addLayer = useStudio((state) => state.addLayer);

  return (
    <nav className="tool-palette" aria-label="Add editable OG elements">
      <button type="button" title="Add text" onClick={() => addLayer("text")}>
        <Type size={15} />
      </button>
      <button type="button" title="Add image" onClick={() => addLayer("image")}>
        <ImagePlus size={15} />
      </button>
      <button type="button" title="Add rectangle" onClick={() => addLayer("rectangle")}>
        <Square size={15} />
      </button>
      <button type="button" title="Add ellipse" onClick={() => addLayer("ellipse")}>
        <Circle size={15} />
      </button>
      <button type="button" title="Add divider" onClick={() => addLayer("line")}>
        <Minus size={15} />
      </button>
    </nav>
  );
}
