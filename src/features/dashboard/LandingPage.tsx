import { Link } from 'react-router-dom';
import {
  Code2,
  Eye,
  MousePointer2,
  FileOutput,
  ArrowRight,
  Presentation,
} from 'lucide-react';

const features = [
  {
    icon: Code2,
    title: 'React Code Rendering',
    desc: 'Paste JSX from external AI tools. Isolated sandbox compiles and renders your presentation safely.',
  },
  {
    icon: Eye,
    title: 'Live Slide Preview',
    desc: 'Navigate every slide with thumbnails, fullscreen, and zoom. See changes the moment you hit Run.',
  },
  {
    icon: MousePointer2,
    title: 'Visual Slide Editing',
    desc: 'Select text, images, and shapes. Move, resize, restyle — without rewriting JSX by hand.',
  },
  {
    icon: FileOutput,
    title: 'Editable PowerPoint Export',
    desc: 'Export native PPTX objects — text boxes, images, shapes — not flat screenshots.',
  },
];

const steps = [
  { n: '01', title: 'Generate React code externally', desc: 'Use ChatGPT, Claude, or Gemini with the authoring contract.' },
  { n: '02', title: 'Paste your code', desc: 'Drop JSX and CSS into the Monaco editor or upload files.' },
  { n: '03', title: 'Preview and edit slides', desc: 'Run code, navigate slides, edit supported elements visually.' },
  { n: '04', title: 'Export PowerPoint', desc: 'Download an editable .pptx with a clear compatibility report.' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-bg-primary/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <Presentation className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-semibold">SlideCraft AI</span>
          </div>
          <nav className="hidden items-center gap-8 text-sm text-text-secondary md:flex">
            <a href="#features" className="hover:text-text-primary">Features</a>
            <a href="#how" className="hover:text-text-primary">How It Works</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="btn-ghost hidden sm:inline-flex">
              Open App
            </Link>
            <Link to="/dashboard" className="btn-primary">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-24 pt-20">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(139,124,255,0.12),_transparent_55%)]" />
        <div className="relative mx-auto max-w-6xl text-center">
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-primary">
            Code → Slides → PPTX
          </p>
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-text-primary sm:text-5xl md:text-6xl">
            Turn React Code Into
            <br />
            <span className="text-primary">Beautiful Presentations.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            Biến mã React thành những bài thuyết trình chuyên nghiệp.
          </p>
          <p className="mx-auto mt-3 max-w-xl text-base text-text-muted">
            Paste your React presentation code, preview every slide, edit visually,
            and export to editable PowerPoint. No AI inside — bring your own code.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link to="/dashboard" className="btn-primary px-6 py-3 text-base">
              Start Creating
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#features" className="btn-secondary px-6 py-3 text-base">
              Explore Features
            </a>
          </div>

          {/* Hero mock */}
          <div className="mx-auto mt-16 grid max-w-4xl gap-4 rounded-xl border border-border bg-card p-4 shadow-card md:grid-cols-2">
            <div className="rounded-lg border border-border bg-bg-secondary p-4 text-left font-mono text-xs text-text-muted">
              <div className="mb-2 text-primary">App.tsx</div>
              <pre className="overflow-hidden whitespace-pre-wrap leading-relaxed">
{`<PresentationDeck>
  <Slide background="#0E111B">
    <SlideText x={80} y={260}
      fontSize={52} color="#F7F7FC">
      Hello World
    </SlideText>
  </Slide>
</PresentationDeck>`}
              </pre>
            </div>
            <div className="flex aspect-video items-center justify-center rounded-lg border border-border bg-bg-secondary">
              <div className="text-center">
                <div className="text-2xl font-semibold text-text-primary">Hello World</div>
                <div className="mt-2 text-sm text-text-muted">Slide 1 / 2</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-display text-3xl font-bold">
            Built for code-first creators
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-text-secondary">
            Four core capabilities. No fake AI buttons.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/15 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-t border-border bg-bg-secondary px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center font-display text-3xl font-bold">How it works</h2>
          <div className="mt-12 grid gap-8 md:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="text-center">
                <div className="mb-3 font-mono text-sm text-primary">{s.n}</div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-10 text-center text-sm text-text-muted">
        SlideCraft AI is a code-to-presentation platform, not an AI presentation generator.
      </footer>
    </div>
  );
}
