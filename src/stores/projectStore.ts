import { create } from 'zustand';
import type { Project, ProjectFile, ProjectSummary } from '@/types/project';
import type { SlideDocument } from '@/types/slide';
import { generateId } from '@/lib/utils';
import { SLIDE_WIDTH, SLIDE_HEIGHT } from '@/types/slide';

interface ProjectState {
  projects: ProjectSummary[];
  currentProject: Project | null;
  isLoading: boolean;
  error: string | null;

  setProjects: (list: ProjectSummary[]) => void;
  setCurrentProject: (p: Project | null) => void;
  createProject: (name: string, description?: string) => Project;
  updateFiles: (files: ProjectFile[]) => void;
  updateSlideDocument: (doc: SlideDocument | null) => void;
  updateProjectMeta: (patch: Partial<Pick<Project, 'name' | 'description' | 'status' | 'thumbnailDataUrl' | 'slideCount'>>) => void;
  touchUpdated: () => void;
}

const emptyDoc = (): SlideDocument => ({
  version: 1,
  slideWidth: SLIDE_WIDTH,
  slideHeight: SLIDE_HEIGHT,
  slides: [],
});

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  isLoading: false,
  error: null,

  setProjects: (list) => set({ projects: list }),

  setCurrentProject: (p) => set({ currentProject: p }),

  createProject: (name, description) => {
    const now = new Date().toISOString();
    const project: Project = {
      id: generateId('proj'),
      name,
      description,
      files: [
        {
          id: generateId('file'),
          path: 'App.tsx',
          name: 'App.tsx',
          language: 'tsx',
          content: DEFAULT_PRESENTATION_CODE,
          isEntry: true,
        },
        {
          id: generateId('file'),
          path: 'styles.css',
          name: 'styles.css',
          language: 'css',
          content: '/* Optional global styles for your presentation */\n',
        },
      ],
      slideDocument: emptyDoc(),
      assets: [],
      settings: { autoSave: true },
      createdAt: now,
      updatedAt: now,
      version: 1,
      status: 'draft',
      slideCount: 0,
    };
    set({ currentProject: project });
    return project;
  },

  updateFiles: (files) => {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: { ...cur, files, updatedAt: new Date().toISOString() },
    });
  },

  updateSlideDocument: (doc) => {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: {
        ...cur,
        slideDocument: doc,
        slideCount: doc?.slides.length ?? 0,
        status: doc && doc.slides.length > 0 ? 'ready' : cur.status,
        updatedAt: new Date().toISOString(),
      },
    });
  },

  updateProjectMeta: (patch) => {
    const cur = get().currentProject;
    if (!cur) return;
    set({
      currentProject: { ...cur, ...patch, updatedAt: new Date().toISOString() },
    });
  },

  touchUpdated: () => {
    const cur = get().currentProject;
    if (!cur) return;
    set({ currentProject: { ...cur, updatedAt: new Date().toISOString() } });
  },
}));

export const DEFAULT_PRESENTATION_CODE = `import {
  PresentationDeck,
  Slide,
  SlideText,
  SlideShape,
} from '@slidecraft/components';

export default function Presentation() {
  return (
    <PresentationDeck>
      <Slide background="#0E111B">
        <SlideShape
          id="accent-bar"
          shapeType="rectangle"
          x={0}
          y={0}
          width={8}
          height={720}
          fill="#8B7CFF"
        />
        <SlideText
          id="title"
          x={80}
          y={260}
          width={1100}
          height={80}
          fontSize={52}
          fontWeight={700}
          color="#F7F7FC"
        >
          Welcome to SlideCraft AI
        </SlideText>
        <SlideText
          id="subtitle"
          x={80}
          y={360}
          width={900}
          height={48}
          fontSize={22}
          color="#B7BED0"
        >
          Paste React code · Preview slides · Edit visually · Export PPTX
        </SlideText>
      </Slide>

      <Slide background="#0E111B">
        <SlideText
          id="s2-title"
          x={80}
          y={80}
          width={1000}
          height={60}
          fontSize={40}
          fontWeight={600}
          color="#F7F7FC"
        >
          How it works
        </SlideText>
        <SlideShape id="step1" x={80} y={180} width={340} height={160} fill="#1C2233" borderRadius={12} />
        <SlideText id="s1t" x={100} y={210} width={300} height={36} fontSize={18} fontWeight={600} color="#8B7CFF">
          1. Generate outside
        </SlideText>
        <SlideText id="s1d" x={100} y={250} width={300} height={60} fontSize={15} color="#B7BED0">
          Use ChatGPT or Claude with the authoring contract.
        </SlideText>

        <SlideShape id="step2" x={460} y={180} width={340} height={160} fill="#1C2233" borderRadius={12} />
        <SlideText id="s2t" x={480} y={210} width={300} height={36} fontSize={18} fontWeight={600} color="#8B7CFF">
          2. Paste & Run
        </SlideText>
        <SlideText id="s2d" x={480} y={250} width={300} height={60} fontSize={15} color="#B7BED0">
          Drop code into the editor and hit Run.
        </SlideText>

        <SlideShape id="step3" x={840} y={180} width={340} height={160} fill="#1C2233" borderRadius={12} />
        <SlideText id="s3t" x={860} y={210} width={300} height={36} fontSize={18} fontWeight={600} color="#8B7CFF">
          3. Edit & Export
        </SlideText>
        <SlideText id="s3d" x={860} y={250} width={300} height={60} fontSize={15} color="#B7BED0">
          Visual edits stay editable in PowerPoint.
        </SlideText>
      </Slide>
    </PresentationDeck>
  );
}
`;
