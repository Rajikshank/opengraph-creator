import { useState } from "react";
import { Download, Layers, Lightbulb, SlidersHorizontal } from "lucide-react";
import { EffectsPanel } from "./EffectsPanel";
import { ExportPublishPanel } from "./ExportPublishPanel";
import { InspectorPanel } from "./InspectorPanel";
import { LayerTree } from "./LayerTree";

type InspectorTab = "layers" | "inspector" | "effects" | "export";

const tabs: Array<{ id: InspectorTab; label: string; icon: typeof Layers }> = [
  { id: "layers", label: "Layers", icon: Layers },
  { id: "inspector", label: "Edit", icon: SlidersHorizontal },
  { id: "effects", label: "Effects", icon: Lightbulb },
  { id: "export", label: "Export", icon: Download }
];

export function InspectorTabs() {
  const [activeTab, setActiveTab] = useState<InspectorTab>("layers");

  return (
    <aside className="studio-panel inspector-tabs">
      <div className="panel-tabs" role="tablist" aria-label="Studio inspector panels">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div className="studio-panel-scroll inspector-tab-body">
        {activeTab === "layers" ? <LayerTree /> : null}
        {activeTab === "inspector" ? <InspectorPanel /> : null}
        {activeTab === "effects" ? <EffectsPanel /> : null}
        {activeTab === "export" ? <ExportPublishPanel /> : null}
      </div>
    </aside>
  );
}
