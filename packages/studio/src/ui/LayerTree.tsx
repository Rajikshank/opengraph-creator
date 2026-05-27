import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  ArrowDown,
  ArrowUp,
  Eye,
  EyeOff,
  FileImage,
  Layers,
  Lock,
  Shapes,
  Trash2,
  Type,
  Unlock
} from "lucide-react";
import { useStudio } from "./studio-store";

export function LayerTree() {
  const project = useStudio((state) => state.project);
  const selectedLayerId = useStudio((state) => state.selectedLayerId);
  const setSelectedLayerId = useStudio((state) => state.setSelectedLayerId);
  const addLayer = useStudio((state) => state.addLayer);
  const alignLayers = useStudio((state) => state.alignLayers);
  const distributeLayers = useStudio((state) => state.distributeLayers);
  const duplicateLayer = useStudio((state) => state.duplicateLayer);
  const deleteLayer = useStudio((state) => state.deleteLayer);
  const reorderLayers = useStudio((state) => state.reorderLayers);
  const toggleLayerHidden = useStudio((state) => state.toggleLayerHidden);
  const toggleLayerLocked = useStudio((state) => state.toggleLayerLocked);
  if (!project) return null;
  const arrangeLayerIds = project.layers.filter((layer) => !layer.locked && !layer.hidden).map((layer) => layer.id);
  const canAlign = arrangeLayerIds.length > 1;
  const canDistribute = arrangeLayerIds.length > 2;

  return (
    <section className="studio-section">
      <h2 className="section-heading">
        <Layers size={15} />
        <span>Layers</span>
      </h2>
      <div className="tool-row">
        <button type="button" title="Add text layer" onClick={() => addLayer("text")}>
          <Type size={14} />
        </button>
        <button type="button" title="Add image layer" onClick={() => addLayer("image")}>
          <FileImage size={14} />
        </button>
        <button type="button" title="Add shape layer" onClick={() => addLayer("rectangle")}>
          <Shapes size={14} />
        </button>
      </div>
      <div className="arrange-tools" aria-label="Arrange unlocked layers">
        <button type="button" title="Align left" disabled={!canAlign} onClick={() => alignLayers(arrangeLayerIds, "left")}>
          <AlignStartVertical size={14} />
        </button>
        <button type="button" title="Align horizontal center" disabled={!canAlign} onClick={() => alignLayers(arrangeLayerIds, "center")}>
          <AlignCenterVertical size={14} />
        </button>
        <button type="button" title="Align right" disabled={!canAlign} onClick={() => alignLayers(arrangeLayerIds, "right")}>
          <AlignEndVertical size={14} />
        </button>
        <button type="button" title="Align top" disabled={!canAlign} onClick={() => alignLayers(arrangeLayerIds, "top")}>
          <AlignStartHorizontal size={14} />
        </button>
        <button type="button" title="Align vertical middle" disabled={!canAlign} onClick={() => alignLayers(arrangeLayerIds, "middle")}>
          <AlignCenterHorizontal size={14} />
        </button>
        <button type="button" title="Align bottom" disabled={!canAlign} onClick={() => alignLayers(arrangeLayerIds, "bottom")}>
          <AlignEndHorizontal size={14} />
        </button>
        <button type="button" title="Distribute horizontally" disabled={!canDistribute} onClick={() => distributeLayers(arrangeLayerIds, "horizontal")}>
          <AlignHorizontalDistributeCenter size={14} />
        </button>
        <button type="button" title="Distribute vertically" disabled={!canDistribute} onClick={() => distributeLayers(arrangeLayerIds, "vertical")}>
          <AlignVerticalDistributeCenter size={14} />
        </button>
      </div>
      <div className="layer-stack">
        {project.layers.map((layer, index) => (
          <div key={layer.id} className={`layer-item ${selectedLayerId === layer.id ? "active" : ""}`}>
            <button type="button" className="layer-select" onClick={() => setSelectedLayerId(layer.id)}>
              <span>{layer.name}</span>
              <small>{layer.kind === "shape" && "shapeType" in layer && layer.shapeType ? layer.shapeType : layer.kind}</small>
            </button>
            <span className="layer-tools">
              <button type="button" title={layer.hidden ? "Show layer" : "Hide layer"} onClick={() => toggleLayerHidden(layer.id)}>
                {layer.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button type="button" title={layer.locked ? "Unlock layer" : "Lock layer"} onClick={() => toggleLayerLocked(layer.id)}>
                {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
              <button type="button" title="Duplicate layer" onClick={() => duplicateLayer(layer.id)}>+</button>
              <button type="button" title="Move layer up" onClick={() => { const over = project.layers[index + 1]; if (over) reorderLayers(layer.id, over.id); }}><ArrowUp size={13} /></button>
              <button type="button" title="Move layer down" onClick={() => { const over = project.layers[index - 1]; if (over) reorderLayers(layer.id, over.id); }}><ArrowDown size={13} /></button>
              <button type="button" title="Delete layer" onClick={() => deleteLayer(layer.id)}><Trash2 size={13} /></button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
