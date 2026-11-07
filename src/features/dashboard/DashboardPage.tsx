import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, FolderOpen, Layers3, Pencil, Plus, Presentation, X } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { formatRelativeTime } from '@/lib/utils';
import { loadProjectSummaries, renameProject, saveProject } from '@/services/storage/projectStorage';
import { ProjectSlidePreview } from '@/components/slide/ProjectSlidePreview';

export function DashboardPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const setProjects = useProjectStore((state) => state.setProjects);
  const currentProject = useProjectStore((state) => state.currentProject);
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);
  const createProject = useProjectStore((state) => state.createProject);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [projectToRename, setProjectToRename] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    try {
      setProjects(loadProjectSummaries());
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Could not load projects.');
    }
  }, [setProjects]);

  const handleNewProject = () => {
    const name = window.prompt('Project name', 'Untitled Presentation');
    if (!name?.trim()) return;

    const project = createProject(name.trim());
    try {
      setProjects(saveProject(project));
      navigate(`/workspace/${project.id}`);
    } catch (error) {
      setLoadError(error instanceof Error ? `Could not create project: ${error.message}` : 'Could not create project.');
    }
  };

  const handleRename = (id: string) => {
    try {
      const result = renameProject(id, nameDraft);
      setProjects(result.projects);
      if (currentProject?.id === id) setCurrentProject(result.project);
      setProjectToRename(null);
      setNameDraft('');
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? `Could not rename project: ${error.message}` : 'Could not rename project.');
    }
  };

  const readyCount = projects.filter((project) => project.slideCount > 0).length;
  const recentProjects = [...projects]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 4);

  return (
    <div className="flex h-full flex-col overflow-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-8 py-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Overview</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-text-secondary">A quick look at your presentations and recent work.</p>
        </div>
        <button type="button" onClick={handleNewProject} className="btn-primary">
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </header>

      {loadError && (
        <div role="alert" className="mx-8 mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {loadError}
        </div>
      )}

      <div className="flex-1 space-y-8 p-8">
        <section className="grid gap-4 sm:grid-cols-3" aria-label="Project statistics">
          <div className="card flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-3 text-primary"><FolderOpen className="h-5 w-5" /></div>
            <div><p className="text-sm text-text-muted">All projects</p><p className="text-2xl font-semibold">{projects.length}</p></div>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-3 text-primary"><Presentation className="h-5 w-5" /></div>
            <div><p className="text-sm text-text-muted">Ready to present</p><p className="text-2xl font-semibold">{readyCount}</p></div>
          </div>
          <div className="card flex items-center gap-4 p-5">
            <div className="rounded-lg bg-primary/10 p-3 text-primary"><Layers3 className="h-5 w-5" /></div>
            <div><p className="text-sm text-text-muted">Total slides</p><p className="text-2xl font-semibold">{projects.reduce((total, project) => total + project.slideCount, 0)}</p></div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Recent projects</h2>
              <p className="mt-1 text-sm text-text-muted">Pick up where you left off.</p>
            </div>
            <Link to="/projects" className="btn-ghost text-sm">
              All projects <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {recentProjects.length === 0 ? (
            <div className="card flex flex-col items-center px-6 py-12 text-center">
              <FolderOpen className="mb-3 h-10 w-10 text-text-muted" />
              <h3 className="font-medium">No projects yet</h3>
              <p className="mt-1 text-sm text-text-secondary">Create a project to start building your first presentation.</p>
              <button type="button" onClick={handleNewProject} className="btn-primary mt-5">
                <Plus className="h-4 w-4" /> Create project
              </button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {recentProjects.map((project) => (
                <article
                  key={project.id}
                  className="card overflow-hidden text-left transition hover:border-primary/40"
                >
                  <button
                    type="button"
                    onClick={() => navigate(`/workspace/${project.id}`)}
                    className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ProjectSlidePreview
                      projectId={project.id}
                      fallbackImage={project.thumbnailDataUrl}
                    />
                    <div className="p-4">
                      <p className="truncate font-medium">{project.name}</p>
                      <p className="mt-1 text-xs text-text-muted">
                        {project.slideCount} slides · {formatRelativeTime(project.updatedAt)}
                      </p>
                    </div>
                  </button>
                  <div className="flex min-h-12 items-center justify-between border-t border-border px-3 py-2">
                    {projectToRename === project.id ? (
                      <>
                        <input
                          autoFocus
                          value={nameDraft}
                          onChange={(event) => setNameDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handleRename(project.id);
                            if (event.key === 'Escape') setProjectToRename(null);
                          }}
                          className="input h-8 min-w-0 px-2 text-xs"
                          aria-label={`New name for ${project.name}`}
                        />
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => handleRename(project.id)}
                            className="btn-ghost px-2 py-1 text-xs text-primary"
                            aria-label="Save project name"
                            disabled={!nameDraft.trim()}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setProjectToRename(null)}
                            className="btn-ghost px-2 py-1 text-xs"
                            aria-label="Cancel rename"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setProjectToRename(project.id);
                          setNameDraft(project.name);
                        }}
                        className="btn-ghost ml-auto px-2 py-1 text-xs text-text-muted"
                        aria-label={`Rename ${project.name}`}
                      >
                        <Pencil className="h-4 w-4" /> Rename
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
