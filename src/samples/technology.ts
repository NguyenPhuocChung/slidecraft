/* Sample 3 — Technology Presentation (12 slides, dark). Fictional platform. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export const technology: Raw = {
  schemaVersion: '1.0',
  id: 'sample-technology',
  title: 'Helix Edge — Architecture Deep Dive',
  description: 'Engineering talk about a fictional real-time edge platform, with diagrams, code and motion.',
  author: 'Helix Platform Team (fictional)',
  theme: 'tech-futuristic',
  aspectRatio: '16:9',
  language: 'en',
  globalStyles: { defaultTransition: { type: 'fade', duration: 500 } },
  slides: [
    {
      id: 'tk-title',
      title: 'Helix Edge',
      elements: [
        { id: 'tk-grid', type: 'decorative', x: 0, y: 0, width: 1920, height: 1080, opacity: 0.6, content: { kind: 'grid', colors: ['$border'] } },
        { id: 'tk-orb', type: 'decorative', x: 1100, y: -200, width: 1000, height: 1000, opacity: 0.6, content: { kind: 'orb', colors: ['$primary'] }, animation: [{ effect: 'pulse', trigger: 'onEnter', duration: 4000, repeat: 'infinite' }] },
        { id: 'tk-eyebrow', type: 'text', x: 140, y: 330, width: 1000, height: 40, content: { text: 'ARCHITECTURE DEEP DIVE · v3' }, style: { fontSize: 22, fontWeight: 700, color: '$accent', letterSpacing: 4 }, animation: [{ effect: 'fadeIn', trigger: 'onEnter', duration: 500 }] },
        { id: 'tk-title-text', type: 'heading', x: 140, y: 390, width: 1300, height: 200, content: { text: 'Helix Edge' }, style: { fontSize: 160, letterSpacing: -6 }, animation: [{ effect: 'blurIn', trigger: 'afterPrevious', duration: 900 }] },
        { id: 'tk-sub', type: 'paragraph', x: 140, y: 610, width: 1100, height: 120, content: { text: 'Running user code within 20 ms of every customer — how we built it.' }, style: { fontSize: 38, color: '$textMuted' }, animation: [{ effect: 'rise', trigger: 'afterPrevious', duration: 600 }] },
        { id: 'tk-cube', type: 'visual3d', x: 1350, y: 450, width: 460, height: 460, content: { kind: 'cube', colors: ['$primary'] }, animation: [{ effect: 'floatIn', trigger: 'afterPrevious', direction: 'up', duration: 900 }] },
      ],
      notes: 'Welcome. This talk covers the request path, the runtime and how deploys propagate.',
    },
    {
      id: 'tk-agenda', layout: 'agenda',
      content: {
        heading: 'Today',
        items: [
          { title: 'Why the edge', text: 'Latency budgets for interactive apps' },
          { title: 'Request path', text: 'From DNS to isolate' },
          { title: 'The runtime', text: 'Isolates, snapshots and cold starts' },
          { title: 'Global deploys', text: 'Propagating code in seconds' },
          { title: 'Results & roadmap' },
        ],
      },
      transition: { type: 'push', direction: 'left', duration: 600 },
      notes: '30 minutes, live demo at the end if time allows.',
    },
    {
      id: 'tk-why', layout: 'bigNumber',
      content: {
        eyebrow: 'Why the edge',
        stats: [{ value: '100 ms', label: 'The point where an interaction stops feeling instant' }],
        body: 'A single round-trip across an ocean can consume most of that budget before your code even runs.',
      },
      notes: 'Classic HCI guideline; our goal is to spend under 20 ms of it on network.',
    },
    {
      id: 'tk-request-path', layout: 'infographic',
      content: {
        heading: 'Request path',
        body: 'Every hop is inside the same point of presence. Only cache misses travel to the origin.',
        diagram: {
          kind: 'flowchart', direction: 'horizontal',
          nodes: [
            { id: 'client', label: 'Client', shape: 'pill' },
            { id: 'anycast', label: 'Anycast DNS' },
            { id: 'pop', label: 'Nearest PoP' },
            { id: 'cache', label: 'Cache hit?', shape: 'diamond' },
            { id: 'isolate', label: 'V8 isolate' },
            { id: 'origin', label: 'Origin', shape: 'ellipse' },
          ],
          edges: [
            { from: 'client', to: 'anycast' }, { from: 'anycast', to: 'pop' }, { from: 'pop', to: 'cache' },
            { from: 'cache', to: 'isolate', label: 'no' }, { from: 'isolate', to: 'origin', label: 'fetch' },
          ],
        },
      },
      transition: { type: 'wipe', direction: 'left', duration: 600 },
      notes: 'Walk left to right. The diamond is where 92% of requests end (illustrative).',
    },
    {
      id: 'tk-runtime', layout: 'imageLeft',
      content: {
        eyebrow: 'The runtime',
        heading: 'Thousands of tenants per machine, isolated by V8',
        bullets: ['Isolates start in ~5 ms instead of containers in seconds', 'Memory snapshots remove module evaluation from cold start', 'CPU time limits enforced per request'],
        image: { query: 'server rack data center blue light', alt: 'Server racks in a data center' },
      },
      notes: 'Compare isolate memory footprint (~3 MB) to a container (~100 MB), illustrative.',
    },
    {
      id: 'tk-code', layout: 'codeFocus',
      content: {
        heading: 'A Helix function',
        code: {
          language: 'typescript', title: 'edge/handler.ts',
          code: "export default {\n  async fetch(req: Request, env: Env): Promise<Response> {\n    const url = new URL(req.url);\n    const cached = await env.CACHE.get(url.pathname);\n    if (cached) return new Response(cached, { headers: { 'x-helix': 'hit' } });\n\n    const res = await fetch(env.ORIGIN + url.pathname);\n    await env.CACHE.put(url.pathname, await res.clone().text(), { ttl: 60 });\n    return res;\n  },\n};",
          highlightLines: [4, 5],
        },
        bullets: ['Standard Fetch API — no proprietary SDK', 'Cache binding injected via `env`', 'Deploys globally with one command'],
      },
      notes: 'Highlight lines 4–5: the cache lookup that makes most requests local.',
    },
    {
      id: 'tk-deploy', title: 'Global deploys',
      elements: [
        { id: 'dp-heading', type: 'heading', x: 120, y: 100, width: 1680, height: 100, content: { text: 'A deploy reaches 310 locations in under 15 seconds' }, style: { fontSize: 58 } },
        { id: 'dp-source', type: 'shape', x: 160, y: 470, width: 300, height: 140, content: { shape: 'roundRect', text: 'Control plane' }, style: { fill: '$primary', color: '#05070f', fontSize: 30, fontWeight: 700, radius: 20 } },
        { id: 'dp-arrow', type: 'arrow', x: 480, y: 540, width: 420, height: 1, content: { x1: 480, y1: 540, x2: 900, y2: 540 }, style: { stroke: { color: '$textMuted', width: 4, dash: 'dash' }, headEnd: 'triangle' }, animation: [{ effect: 'wipe', trigger: 'onClick', direction: 'right', duration: 600 }] },
        { id: 'dp-hub', type: 'shape', x: 920, y: 470, width: 300, height: 140, content: { shape: 'roundRect', text: 'Regional hubs' }, style: { fill: '$secondary', color: '#05070f', fontSize: 30, fontWeight: 700, radius: 20 }, animation: [{ effect: 'zoomIn', trigger: 'afterPrevious', duration: 400 }] },
        { id: 'dp-pop-1', type: 'shape', x: 1500, y: 300, width: 220, height: 100, content: { shape: 'pill', text: 'PoP · AMS' }, style: { fill: '$surface', color: '$text', fontSize: 24, stroke: { color: '$accent', width: 2 } }, animation: [{ effect: 'flyIn', trigger: 'afterPrevious', direction: 'right', duration: 500 }] },
        { id: 'dp-pop-2', type: 'shape', x: 1500, y: 490, width: 220, height: 100, content: { shape: 'pill', text: 'PoP · SIN' }, style: { fill: '$surface', color: '$text', fontSize: 24, stroke: { color: '$accent', width: 2 } }, animation: [{ effect: 'flyIn', trigger: 'withPrevious', direction: 'right', duration: 500, delay: 120 }] },
        { id: 'dp-pop-3', type: 'shape', x: 1500, y: 680, width: 220, height: 100, content: { shape: 'pill', text: 'PoP · GRU' }, style: { fill: '$surface', color: '$text', fontSize: 24, stroke: { color: '$accent', width: 2 } }, animation: [{ effect: 'flyIn', trigger: 'withPrevious', direction: 'right', duration: 500, delay: 240 }] },
        { id: 'dp-packet', type: 'shape', x: 470, y: 525, width: 30, height: 30, content: { shape: 'ellipse' }, style: { fill: '$accent' }, animation: [{ effect: 'motionPath', trigger: 'onClick', duration: 1600, easing: 'easeInOut', path: { type: 'custom', d: 'M0 0 C 300 -160 700 -160 1040 -220' } }] },
        { id: 'dp-caption', type: 'paragraph', x: 120, y: 900, width: 1400, height: 80, content: { text: 'Bundles are content-addressed, so hubs only fetch what changed. (Illustrative timings.)' }, style: { fontSize: 26, color: '$textMuted' } },
      ],
      transition: { type: 'fade', duration: 500 },
      notes: 'Click twice: the arrow draws, then the packet travels along a Bézier motion path to Amsterdam.',
    },
    {
      id: 'tk-architecture', layout: 'process',
      content: {
        heading: 'Deploy pipeline',
        diagram: {
          kind: 'chevronProcess',
          items: [
            { title: 'Build', text: 'Bundle & tree-shake with esbuild', value: '2 s' },
            { title: 'Snapshot', text: 'Pre-evaluate modules into a heap snapshot', value: '1 s' },
            { title: 'Distribute', text: 'Push to hubs over QUIC', value: '6 s' },
            { title: 'Activate', text: 'Atomic version switch per PoP', value: '<1 s' },
          ],
        },
      },
      notes: 'Times are p50 for a 1 MB bundle (illustrative).',
    },
    {
      id: 'tk-before-after', layout: 'beforeAfter',
      content: {
        heading: 'Moving the checkout API to Helix',
        before: { heading: 'Central region', bullets: ['p95 latency 410 ms in Asia', 'Cold starts up to 1.8 s', 'Manual multi-region failover'] },
        after: { heading: 'Helix Edge', bullets: ['p95 latency 46 ms worldwide', 'Cold start ~5 ms', 'Automatic failover between PoPs'] },
      },
      notes: 'Fictional customer case; illustrative numbers.',
    },
    {
      id: 'tk-results', layout: 'chartFocus',
      content: {
        heading: 'Latency by region after migration',
        chart: {
          chartType: 'bar', categories: ['North America', 'Europe', 'South America', 'Asia-Pacific', 'Africa'],
          series: [{ name: 'Before (p95 ms)', values: [120, 180, 320, 410, 460] }, { name: 'After (p95 ms)', values: [38, 41, 52, 46, 61] }],
          valueSuffix: ' ms', showLabels: true, source: 'Illustrative data',
        },
      },
      transition: { type: 'cube', direction: 'left', duration: 900 },
      notes: 'The long tail regions benefit most.',
    },
    {
      id: 'tk-roadmap', title: 'Roadmap',
      elements: [
        { id: 'rm-heading', type: 'heading', x: 120, y: 100, width: 1680, height: 100, content: { text: 'Roadmap' }, style: { fontSize: 64 } },
        { id: 'rm-diagram', type: 'diagram', x: 120, y: 260, width: 1680, height: 700, content: { kind: 'roadmap', items: [
          { title: 'Durable objects', text: 'Strongly consistent state at the edge', status: 'done', value: 'Q1' },
          { title: 'GPU inference', text: 'Small models next to users', status: 'active', value: 'Q3' },
          { title: 'Edge SQL', text: 'Read replicas in every PoP', status: 'planned', value: 'Q4' },
          { title: 'WASI components', text: 'Bring any language', status: 'planned', value: '2027' },
        ] }, animation: [{ effect: 'wipe', trigger: 'onEnter', direction: 'right', duration: 1000 }] },
      ],
      notes: 'GPU inference is in private beta.',
    },
    {
      id: 'tk-closing', layout: 'closing',
      content: { heading: 'Questions?', subheading: 'docs.helix.example · @helixedge', cta: 'Try the free tier' },
      transition: { type: 'zoom', duration: 700 },
      notes: 'Offer to share the slides and the benchmark scripts.',
    },
  ],
};
