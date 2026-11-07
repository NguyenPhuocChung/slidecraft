import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Play,
  Save,
  Download,
  ArrowLeft,
  FileCode2,
  AlertCircle,
  Copy,
  Maximize,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';
import { useProjectStore, DEFAULT_PRESENTATION_CODE } from '@/stores/projectStore';
import { useEditorStore } from '@/stores/editorStore';
import { parseContractSlides } from '@/engine/slide-parser/parseContract';
import { exportToPptx } from '@/services/export/pptx';
import { loadProject, saveProject } from '@/services/storage/projectStorage';
import { SlideCanvas } from '@/components/slide/SlideCanvas';
import type { ProjectFile } from '@/types/project';
import { generateId } from '@/lib/utils';

/** Workspace editor and presentation controls for one project. */
export function WorkspacePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const current = useProjectStore((s) => s.currentProject);
  const setCurrent = useProjectStore((s) => s.setCurrentProject);
  const setProjects = useProjectStore((s) => s.setProjects);
  const updateFiles = useProjectStore((s) => s.updateFiles);
  const updateSlideDocument = useProjectStore((s) => s.updateSlideDocument);
  const updateMeta = useProjectStore((s) => s.updateProjectMeta);

  const selectedSlideId = useEditorStore((s) => s.selectedSlideId);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const lastError = useEditorStore((s) => s.lastError);
  const setLastError = useEditorStore((s) => s.setLastError);

  const [code, setCode] = useState(DEFAULT_PRESENTATION_CODE);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const [showCode, setShowCode] = useState(true);
  const [previewScale, setPreviewScale] = useState(0.5);
  const [presenting, setPresenting] = useState(false);
  const [presentationScale, setPresentationScale] = useState(0.5);
  const previewRef = useRef<HTMLDivElement>(null);
  const presentationRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  // Ensure a project exists for this route
  useEffect(() => {
    if (!projectId) return;
    if (current?.id === projectId) {
      const entry = current.files.find((f) => f.isEntry) ?? current.files[0];
      if (entry) setCode(entry.content);
      return;
    }
    try {
      const savedProject = loadProject(projectId);
      if (savedProject) {
        setCurrent(savedProject);
        const entry = savedProject.files.find((file) => file.isEntry) ?? savedProject.files[0];
        if (entry) setCode(entry.content);
        return;
      }
    } catch (error) {
      setLastError(error instanceof Error ? error.message : 'Could not load this project.');
      return;
    }

    setLastError('Project not found. It may have been deleted or not saved yet.');
    navigate('/projects', { replace: true });
  }, [projectId, current, navigate, setCurrent, setLastError]);

  const slides = current?.slideDocument?.slides ?? [];
  const activeSlide =
    slides.find((s) => s.id === selectedSlideId) ?? slides[0] ?? null;
  const activeSlideIndex = activeSlide
    ? slides.findIndex((slide) => slide.id === activeSlide.id)
    : -1;

  const closePresentation = () => {
    setPresenting(false);
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch((error: unknown) => {
        setLastError(error instanceof Error ? error.message : 'Could not exit fullscreen.');
      });
    }
  };

  const startPresentation = () => {
    if (slides.length === 0) {
      setLastError('Run the code first to create slides before presenting.');
      return;
    }
    selectSlide(slides[0].id);
    setPresenting(true);
    if (workspaceRef.current?.requestFullscreen) {
      void workspaceRef.current.requestFullscreen().catch((error: unknown) => {
        setLastError(
          error instanceof Error
            ? `Fullscreen unavailable; presenting in this window. ${error.message}`
            : 'Fullscreen unavailable; presenting in this window.',
        );
      });
    }
  };

  useEffect(() => {
    if (!presenting) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closePresentation();
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault();
        if (activeSlideIndex < slides.length - 1) {
          selectSlide(slides[activeSlideIndex + 1].id);
        }
      } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault();
        if (activeSlideIndex > 0) {
          selectSlide(slides[activeSlideIndex - 1].id);
        }
      } else if (event.key === 'Home') {
        event.preventDefault();
        selectSlide(slides[0].id);
      } else if (event.key === 'End') {
        event.preventDefault();
        selectSlide(slides[slides.length - 1].id);
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [presenting, activeSlideIndex, slides, selectSlide]);

  useEffect(() => {
    const viewport = previewRef.current;
    if (!viewport || !activeSlide) return;
    const updateScale = () => {
      const width = viewport.clientWidth - 32;
      const height = viewport.clientHeight - 32;
      if (width > 0 && height > 0) {
        setPreviewScale(Math.min(1, width / activeSlide.width, height / activeSlide.height));
      }
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    updateScale();
    return () => observer.disconnect();
  }, [activeSlide?.id, activeSlide?.width, activeSlide?.height, showCode]);

  useEffect(() => {
    const viewport = presentationRef.current;
    if (!presenting || !viewport || !activeSlide) return;
    const updateScale = () => {
      const width = viewport.clientWidth - 48;
      const height = viewport.clientHeight - 48;
      if (width > 0 && height > 0) {
        setPresentationScale(Math.min(width / activeSlide.width, height / activeSlide.height));
      }
    };
    const observer = new ResizeObserver(updateScale);
    observer.observe(viewport);
    updateScale();
    return () => observer.disconnect();
  }, [presenting, activeSlide?.id, activeSlide?.width, activeSlide?.height]);

  const handleRun = () => {
    setRunning(true);
    setLastError(null);
    try {
      const doc = parseContractSlides(code);
      updateSlideDocument(doc);
      if (doc.slides[0]) selectSlide(doc.slides[0].id);
      updateMeta({ status: 'ready', slideCount: doc.slides.length });
      // Persist code into project files
      const entryFile = current?.files.find((file) => file.isEntry) ?? current?.files[0];
      const nextEntry: ProjectFile = {
        id: entryFile?.id ?? generateId('file'),
        path: entryFile?.path ?? 'App.tsx',
        name: entryFile?.name ?? 'App.tsx',
        language: entryFile?.language ?? 'tsx',
        content: code,
        isEntry: true,
      };
      const files = entryFile
        ? (current?.files ?? []).map((file) => (file.id === entryFile.id ? nextEntry : file))
        : [nextEntry, ...(current?.files ?? [])];
      updateFiles(files);
      setSaveStatus('idle');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setLastError(msg);
      updateMeta({ status: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const handleSave = () => {
    if (!current) return;
    const entryFile = current.files.find((file) => file.isEntry) ?? current.files[0];
    const files: ProjectFile[] = entryFile
      ? current.files.map((file) =>
        file.id === entryFile.id ? { ...file, content: code, isEntry: true } : file,
      )
      : [{
        id: generateId('file'),
        path: 'App.tsx',
        name: 'App.tsx',
        language: 'tsx',
        content: code,
        isEntry: true,
      }];
    const snapshot = {
      ...current,
      files,
      updatedAt: new Date().toISOString(),
    };
    try {
      const projects = saveProject(snapshot);
      setCurrent(snapshot);
      setProjects(projects);
      setLastError(null);
      setSaveStatus('saved');
    } catch (error) {
      setSaveStatus('idle');
      setLastError(error instanceof Error ? `Could not save project: ${error.message}` : 'Could not save project.');
    }
  };

  const handleExport = async () => {
    if (!current?.slideDocument || current.slideDocument.slides.length === 0) {
      setLastError('Run the code first to produce slides before exporting.');
      return;
    }
    setExporting(true);
    setLastError(null);
    try {
      await exportToPptx(current.slideDocument, current.name || 'presentation');
    } catch (e) {
      setLastError(e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const copyAuthoringContract = async () => {
    try {
      const res = await fetch('/authoring-contract.txt');
      // Fallback: hard-coded short prompt
      const text = `Bạn là SlideCraft AI Engine — Chuyên gia Thiết kế UI/UX Presentation và Lập trình viên React Senior.

Nhiệm vụ: Chuyển đổi nội dung thuyết trình của khách hàng thành file React TSX hoàn chỉnh, thiết kế đẳng cấp như Designer chuyên nghiệp, tuân thủ 100% Authoring Contract và tối ưu sẵn cho hiệu ứng Morph PowerPoint.

==================================================
1. NGUYÊN TẮC KỸ THUẬT BẮT BUỘC (STRICT CONTRACT RULES)
==================================================
- Tỉ lệ slide: 1280 x 720 px.
- Khai báo import chuẩn:
  import { PresentationDeck, Slide, SlideText, SlideShape, SlideImage } from '@slidecraft/components';
- TUYỆT ĐỐI KHÔNG dùng style={{}}, KHÔNG dùng CSS class, KHÔNG dùng thẻ HTML (<div>, <br/>, <span>, \\n).
- Mọi thuộc tính BẮT BUỘC truyền trực tiếp dưới dạng prop:
  + Slide: id, background (Màu Hex).
  + SlideShape: id, shapeType ("rectangle" | "rounded-rectangle" | "circle"), x, y, width, height, fill (Màu Hex), borderRadius (nếu có).
+ SlideText: id, x, y, width, height, fontSize, fontWeight, color, textAlign ("left" | "center" | "right"). Nội dung chữ nằm giữa thẻ đóng/mở. Khi muốn xuống dòng trong văn bản, hãy Enter xuống dòng trực tiếp (TUYỆT ĐỐI KHÔNG dùng ký tự \n hay thẻ <br/>).  + SlideImage: id, src (URL ảnh), x, y, width, height, objectFit ("cover" | "contain"), borderRadius (nếu có).

==================================================
2. QUY CHUẨN TƯƠNG THÍCH CHUYỂN CẢNH MORPH (MORPH-READY CONTINUITY)
==================================================

==================================================
3. QUY TẮC PHỐI MÀU & HÌNH ẢNH / ICON
==================================================
- CHỌN PALETTE MÀU DỰA TRÊN CHỦ ĐỀ

==================================================
4.BỐ CỤC SLIDE (MỖI SLIDE 1 BỐ CỤC KHÁC NHAU )
(phong cách lựa theo nội dung, hoặc bạn có thêu sáng tạo bố cục mới nhưng vẫn phải tuân thủ các nguyên tắc trên)

==================================================

==================================================
NỘI DUNG THUYẾT TRÌNH CỦA KHÁCH HÀNG:
==================================================

==================================================
YÊU CẦU ĐẦU RA:
==================================================
Chỉ trả về duy nhất 1 đoạn mã React TSX hợp lệ (bắt đầu bằng \`\`\`tsx và kết thúc bằng \`\`\`). Không kèm theo bất kỳ câu thoại hay lời giải thích nào khác.`;

      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={workspaceRef} className="flex h-full min-h-0 flex-col bg-bg-primary">
      {/* Toolbar */}
      <div className="flex h-14 items-center gap-2 border-b border-border bg-bg-secondary px-4">
        <Link
          to="/dashboard"
          className="btn-ghost px-2"
          title="Back to dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">
          {current?.name ?? 'Workspace'}
        </div>
        <button type="button" onClick={copyAuthoringContract} className="btn-ghost text-xs" title="Copy authoring hint">
          <Copy className="h-3.5 w-3.5" />
          Code Prompt
        </button>
        <button
          type="button"
          onClick={() => setShowCode((visible) => !visible)}
          className="btn-ghost text-xs"
          title={showCode ? 'Hide code editor' : 'Show code editor'}
          aria-label={showCode ? 'Hide code editor' : 'Show code editor'}
          aria-expanded={showCode}
          aria-controls="code-editor"
        >
          <FileCode2 className="h-3.5 w-3.5" />
          {showCode ? 'Hide code' : 'Show code'}
        </button>
        <button
          type="button"
          onClick={startPresentation}
          disabled={slides.length === 0}
          className="btn-secondary"
          title="Start full-screen presentation"
        >
          <Maximize className="h-4 w-4" />
          Present
        </button>
        <button
          type="button"
          onClick={handleRun}
          disabled={running}
          className="btn-primary"
        >
          <Play className="h-4 w-4" />
          {running ? 'Running…' : 'Run Code'}
        </button>
        <button type="button" onClick={handleSave} className="btn-secondary">
          <Save className="h-4 w-4" />
          {saveStatus === 'saved' ? 'Saved' : 'Save'}
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export PPTX'}
        </button>
      </div>

      {lastError && (
        <div className="flex items-start gap-2 border-b border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <pre className="whitespace-pre-wrap font-mono text-xs">{lastError}</pre>
        </div>
      )}

      {/* Main split */}
      <div className="flex min-h-0 flex-1">
        {/* Code */}
        <div
          id="code-editor"
          className={`${showCode ? 'flex' : 'hidden'} w-1/2 min-w-0 flex-col border-r border-border`}
        >
          <div className="flex h-9 items-center gap-2 border-b border-border bg-bg-tertiary px-3 text-xs text-text-muted">
            <FileCode2 className="h-3.5 w-3.5" />
            App.tsx
          </div>
          <textarea
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setSaveStatus('idle');
            }}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none bg-bg-primary p-4 font-mono text-sm leading-relaxed text-text-primary outline-none"
          />
        </div>

        {/* Preview + nav */}
        <div className={`flex min-w-0 flex-col bg-bg-secondary ${showCode ? 'w-1/2' : 'w-full'}`}>
          <div className="flex min-h-0 flex-1">
            {/* Thumbnails */}
            <div className="w-28 shrink-0 overflow-y-auto border-r border-border p-2">
              {slides.length === 0 ? (
                <p className="p-2 text-center text-xs text-text-muted">
                  Run code to see slides
                </p>
              ) : (
                slides.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => selectSlide(s.id)}
                    aria-label={`Select slide ${i + 1}`}
                    className={`mb-2 w-full rounded border p-1 text-left transition ${activeSlide?.id === s.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-text-muted'
                      }`}
                  >
                    <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded bg-bg-primary">
                      <SlideCanvas
                        slide={s}
                        scale={Math.min(96 / s.width, 54 / s.height)}
                      />
                      <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 text-[10px] leading-4 text-white">
                        {i + 1}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Slide canvas — two layers so text can never sit under shapes */}
            <div ref={previewRef} className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto p-4">
              {activeSlide ? (
                <SlideCanvas slide={activeSlide} scale={previewScale} />
              ) : (
                <div className="text-center text-text-muted">
                  <p className="text-sm">No slides yet</p>
                  <p className="mt-1 text-xs">Paste contract-compliant code and press Run</p>
                </div>
              )}
            </div>
          </div>
          {presenting && activeSlide && (
            <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
              <header className="flex h-14 shrink-0 items-center justify-between bg-black/80 px-5">
                <span className="truncate text-sm font-medium">{current?.name ?? 'Presentation'}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-white/70">{activeSlideIndex + 1} / {slides.length}</span>
                  <button
                    type="button"
                    onClick={closePresentation}
                    className="btn-ghost text-white hover:bg-white/10 hover:text-white"
                    aria-label="Exit presentation"
                    title="Exit presentation (Esc)"
                  >
                    <X className="h-4 w-4" />
                    Exit
                  </button>
                </div>
              </header>
              <div
                ref={presentationRef}
                className="flex min-h-0 flex-1 items-center justify-center overflow-hidden"
              >
                <SlideCanvas slide={activeSlide} scale={presentationScale} />
              </div>
              <footer className="flex h-16 shrink-0 items-center justify-center gap-5 bg-black/80">
                <button
                  type="button"
                  onClick={() => activeSlideIndex > 0 && selectSlide(slides[activeSlideIndex - 1].id)}
                  disabled={activeSlideIndex <= 0}
                  className="btn-ghost text-white hover:bg-white/10 hover:text-white"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="h-5 w-5" />
                  Previous
                </button>
                <span className="text-xs text-white/50">Use ← → or Page Up / Page Down</span>
                <button
                  type="button"
                  onClick={() => activeSlideIndex < slides.length - 1 && selectSlide(slides[activeSlideIndex + 1].id)}
                  disabled={activeSlideIndex >= slides.length - 1}
                  className="btn-ghost text-white hover:bg-white/10 hover:text-white"
                  aria-label="Next slide"
                >
                  Next
                  <ChevronRight className="h-5 w-5" />
                </button>
              </footer>
            </div>
          )}

          {current?.slideDocument?.compatibility && (
            <div className="border-t border-border px-4 py-2 text-xs text-text-muted">
              Compatibility: {current.slideDocument.compatibility.fullyEditable ? 'fully editable' : 'partial'} ·{' '}
              {current.slideDocument.compatibility.approximateElements} approximate ·{' '}
              {current.slideDocument.compatibility.unsupportedElements} unsupported
            </div>
          )}
        </div>
      </div>
    </div>
  );
}