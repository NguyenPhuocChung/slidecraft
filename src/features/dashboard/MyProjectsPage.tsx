import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, FolderOpen, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { formatRelativeTime } from '@/lib/utils';
import { deleteProject, loadProjectSummaries, renameProject } from '@/services/storage/projectStorage';
import { ProjectSlidePreview } from '@/components/slide/ProjectSlidePreview';

export function MyProjectsPage() {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const setProjects = useProjectStore((state) => state.setProjects);
  const currentProject = useProjectStore((state) => state.currentProject);
  const setCurrentProject = useProjectStore((state) => state.setCurrentProject);
  const [query, setQuery] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [projectToRename, setProjectToRename] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setProjects(loadProjectSummaries());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load projects.');
    }
  }, [setProjects]);

  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return [...projects]
      .filter((project) => project.name.toLowerCase().includes(normalizedQuery))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [projects, query]);

  const handleDelete = (id: string) => {
    try {
      setProjects(deleteProject(id));
      if (currentProject?.id === id) setCurrentProject(null);
      setProjectToDelete(null);
      setError(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? `Could not delete project: ${deleteError.message}` : 'Could not delete project.');
    }
  };

  const beginRename = (id: string, name: string) => {
    setProjectToRename(id);
    setNameDraft(name);
    setProjectToDelete(null);
  };

  const handleRename = (id: string) => {
    try {
      const result = renameProject(id, nameDraft);
      setProjects(result.projects);
      if (currentProject?.id === id) setCurrentProject(result.project);
      setProjectToRename(null);
      setNameDraft('');
      setError(null);
    } catch (renameError) {
      setError(renameError instanceof Error ? `Could not rename project: ${renameError.message}` : 'Could not rename project.');
    }
  };

  return (
    <div className="flex h-full flex-col overflow-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-8 py-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Library</p>
          <h1 className="mt-1 font-display text-2xl font-semibold">My Projects</h1>
          <p className="mt-1 text-sm text-text-secondary">Browse, reopen, or remove your saved presentations.</p>
        </div>
        <label className="relative block w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
            className="input pl-9"
            aria-label="Search projects"
          />
        </label>
      </header>

      {error && (
        <div role="alert" className="mx-8 mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex-1 p-8">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-bg-secondary px-6 py-24 text-center">
            <FolderOpen className="mb-4 h-12 w-12 text-text-muted" />
            <h2 className="text-lg font-medium">{query ? 'No matching projects' : 'No saved projects yet'}</h2>
            <p className="mt-2 max-w-sm text-sm text-text-secondary">
              {query ? 'Try another project name.' : 'Create a project from the dashboard, then save it to keep it here.'}
            </p>
            {!query && (
              <button type="button" onClick={() => navigate('/dashboard')} className="btn-primary mt-6">
                <Plus className="h-4 w-4" /> Go to Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProjects.map((project) => (
              <article key={project.id} className="card flex flex-col overflow-hidden">
                <button
                  type="button"
                  onClick={() => navigate(`/workspace/${project.id}`)}
                  className="flex flex-1 flex-col text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <ProjectSlidePreview
                    projectId={project.id}
                    fallbackImage={project.thumbnailDataUrl}
                  />
                  <div className="w-full p-4">
                    <p className="truncate font-medium">{project.name}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      {project.slideCount} slides · {formatRelativeTime(project.updatedAt)}
                    </p>
                    <p className="mt-2 text-xs capitalize text-text-secondary">{project.status}</p>
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
                  ) : projectToDelete === project.id ? (
                    <>
                      <span className="text-xs text-text-muted">Delete permanently?</span>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => setProjectToDelete(null)} className="btn-ghost px-2 py-1 text-xs">
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(project.id)}
                          className="btn-ghost px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="ml-auto flex gap-1">
                      <button
                        type="button"
                        onClick={() => beginRename(project.id, project.name)}
                        className="btn-ghost px-2 py-1 text-xs text-text-muted"
                        aria-label={`Rename ${project.name}`}
                      >
                        <Pencil className="h-4 w-4" /> Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProjectToDelete(project.id);
                          setProjectToRename(null);
                        }}
                        className="btn-ghost px-2 py-1 text-xs text-text-muted hover:text-red-300"
                        aria-label={`Delete ${project.name}`}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
