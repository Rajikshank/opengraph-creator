import { createManualProject, useStudio } from "./studio-store";

export function ProjectPicker({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const projects = useStudio((state) => state.projects);
  const replaceProject = useStudio((state) => state.replaceProject);
  const session = useStudio((state) => state.session);

  return (
    <main className="project-picker" data-enter>
      <section className="picker-panel">
        <div className="picker-kicker">Ogloom Studio</div>
        <h1>Select a project or connect an agent session</h1>
        <p>
          Open a generated OG project, import a source artifact, or start a manual draft. No coding agent is connected
          unless a session is opened with ?session=&lt;id&gt;.
        </p>
        {session ? (
          <div className="session-strip">
            <strong>{session.agent}</strong>
            <span>{session.status}</span>
            <small>{session.id}</small>
          </div>
        ) : (
          <div className="session-strip muted">
            <strong>No agent detected</strong>
            <span>Open Codex, Claude, or OpenCode with the Ogloom skill to sync a session.</span>
          </div>
        )}
        <button type="button" className="primary-action" onClick={() => replaceProject(createManualProject("Manual OG Draft"))}>
          Start manual draft
        </button>
      </section>
      <section className="picker-panel">
        <div className="section-heading">Recent projects</div>
        <div className="library-list">
          {projects.length ? (
            projects.map((project) => (
              <button type="button" key={project.projectId} onClick={() => onOpenProject(project.projectId)}>
                {project.name}
              </button>
            ))
          ) : (
            <p className="quiet-copy">No saved Studio projects yet. Import JSON, SVG, HTML, or image output from an agent.</p>
          )}
        </div>
      </section>
    </main>
  );
}
