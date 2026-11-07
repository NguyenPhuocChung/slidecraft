import type { Project, ProjectSummary } from '@/types/project';

const PROJECT_KEY_PREFIX = 'slidecraft-project-';
const PROJECT_INDEX_KEY = 'slidecraft-project-index';

function isProjectSummary(value: unknown): value is ProjectSummary {
  if (!value || typeof value !== 'object') return false;
  const summary = value as Partial<ProjectSummary>;
  return (
    typeof summary.id === 'string' &&
    typeof summary.name === 'string' &&
    typeof summary.slideCount === 'number' &&
    typeof summary.createdAt === 'string' &&
    typeof summary.updatedAt === 'string' &&
    (summary.status === 'draft' || summary.status === 'ready' || summary.status === 'error')
  );
}

function toSummary(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    slideCount: project.slideCount,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    status: project.status,
    thumbnailDataUrl: project.thumbnailDataUrl,
  };
}

export function loadProjectSummaries(): ProjectSummary[] {
  const storedIndex = localStorage.getItem(PROJECT_INDEX_KEY);
  if (storedIndex !== null) {
    const parsed: unknown = JSON.parse(storedIndex);
    if (!Array.isArray(parsed) || !parsed.every(isProjectSummary)) {
      throw new Error('Saved project list is invalid. Please clear the corrupted project index.');
    }
    return parsed;
  }

  const summaries: ProjectSummary[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(PROJECT_KEY_PREFIX)) continue;
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (
      value &&
      typeof value === 'object' &&
      'id' in value &&
      'files' in value &&
      Array.isArray(value.files)
    ) {
      const project = value as Project;
      summaries.push(toSummary(project));
    }
  }
  return summaries;
}

export function loadProject(id: string): Project | null {
  const storedProject = localStorage.getItem(`${PROJECT_KEY_PREFIX}${id}`);
  if (storedProject === null) return null;

  const project: unknown = JSON.parse(storedProject);
  if (
    !project ||
    typeof project !== 'object' ||
    !('id' in project) ||
    project.id !== id ||
    !('files' in project) ||
    !Array.isArray(project.files)
  ) {
    throw new Error('Saved project data is invalid.');
  }
  return project as Project;
}

export function saveProject(project: Project): ProjectSummary[] {
  const summaries = loadProjectSummaries().filter((summary) => summary.id !== project.id);
  const updatedSummaries = [toSummary(project), ...summaries];

  localStorage.setItem(`${PROJECT_KEY_PREFIX}${project.id}`, JSON.stringify(project));
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(updatedSummaries));
  return updatedSummaries;
}

export function renameProject(id: string, name: string): { project: Project; projects: ProjectSummary[] } {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Project name cannot be empty.');
  }

  const project = loadProject(id);
  if (!project) {
    throw new Error('Project not found. Save it before renaming.');
  }

  const renamedProject = {
    ...project,
    name: normalizedName,
    updatedAt: new Date().toISOString(),
  };
  return {
    project: renamedProject,
    projects: saveProject(renamedProject),
  };
}

export function deleteProject(id: string): ProjectSummary[] {
  const updatedSummaries = loadProjectSummaries().filter((summary) => summary.id !== id);
  localStorage.removeItem(`${PROJECT_KEY_PREFIX}${id}`);
  localStorage.setItem(PROJECT_INDEX_KEY, JSON.stringify(updatedSummaries));
  return updatedSummaries;
}
