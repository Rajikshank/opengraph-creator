import { useEffect, useState } from "react";
import { Link2, Sparkles } from "lucide-react";
import { readConnectRecipeViaApi, type ConnectRecipe } from "../api";
import { notifyStudioSuccess, notifyStudioWarning } from "../lib/studio-toast";

export function ConnectAgentPanel({ repo, compact = false }: { repo?: string; compact?: boolean }) {
  const [repoPath, setRepoPath] = useState(repo ?? "");
  const [recipe, setRecipe] = useState<ConnectRecipe | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setRepoPath(repo ?? "");
    if (!repo) {
      setRecipe(null);
      return;
    }
    void loadRecipe(repo);
  }, [repo]);

  const loadRecipe = async (targetRepo = repoPath) => {
    const trimmed = targetRepo.trim();
    if (!trimmed) {
      notifyStudioWarning("Repo path required", "Enter the app repo path before requesting an agent connection recipe.");
      return;
    }
    setLoading(true);
    try {
      setRecipe(await readConnectRecipeViaApi(fetch, trimmed));
    } catch {
      notifyStudioWarning("Connection recipe unavailable", "Launch Studio through opengraph-creator studio or check the local Studio server.");
    } finally {
      setLoading(false);
    }
  };

  const copyRecipe = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      notifyStudioSuccess(`${label} copied`);
    } catch {
      notifyStudioWarning(`${label}: ${value}`);
    }
  };

  return (
    <section className={`agent-connect-card ${compact ? "compact" : ""}`}>
      <div className="section-heading">
        <Link2 size={15} />
        <span>Agent connection</span>
      </div>
      <p className="quiet-copy">
        Connect Codex, Claude Code, or OpenCode to this repo when Studio was opened directly. Import stays for files; this is the agent bridge.
      </p>
      <label>
        Repo path
        <input value={repoPath} onChange={(event) => setRepoPath(event.target.value)} placeholder="D:/apps/my-project" />
      </label>
      <button type="button" className="secondary-action" onClick={() => void loadRecipe()} disabled={loading}>
        <Link2 size={15} /> {loading ? "Reading recipe..." : "Get connection recipe"}
      </button>
      {recipe ? (
        <div className="agent-recipe-block">
          <code className="recipe-code">{recipe.command}</code>
          <div className="agent-recipe-actions">
            <button type="button" className="secondary-action" onClick={() => void copyRecipe(recipe.command, "Command")}>
              <Link2 size={15} /> Copy command
            </button>
            <button type="button" className="secondary-action" onClick={() => void copyRecipe(recipe.prompt, "Agent prompt")}>
              <Sparkles size={15} /> Copy prompt
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
