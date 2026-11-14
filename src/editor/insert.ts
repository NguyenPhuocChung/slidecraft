import type { SlideElement } from '@/types/schema';
import type { ChartType, DiagramKind, InfographicKind } from '@/types/registry';

type Partial_ = Partial<SlideElement> & Pick<SlideElement, 'type'>;

export function centered(w: number, h: number, size: { width: number; height: number }) {
  return { x: Math.round((size.width - w) / 2), y: Math.round((size.height - h) / 2), width: w, height: h };
}

export const SAMPLE_CHART_DATA: Record<ChartType, () => Record<string, unknown>> = {
  bar: () => ({ categories: ['North', 'South', 'East', 'West'], series: [{ name: 'Revenue', values: [42, 35, 28, 51] }] }),
  column: () => ({ categories: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: '2025', values: [12, 18, 22, 30] }, { name: '2026', values: [16, 21, 27, 36] }] }),
  stackedBar: () => ({ categories: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Product A', values: [10, 12, 15, 18] }, { name: 'Product B', values: [6, 8, 9, 12] }] }),
  line: () => ({ categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], series: [{ name: 'Users (K)', values: [12, 15, 19, 24, 31, 38] }], smooth: true }),
  area: () => ({ categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], series: [{ name: 'Traffic', values: [20, 26, 24, 33, 41, 48] }] }),
  pie: () => ({ categories: ['Direct', 'Search', 'Social', 'Referral'], series: [{ name: 'Share', values: [38, 30, 20, 12] }], valueSuffix: '%' }),
  donut: () => ({ categories: ['Done', 'In progress', 'Planned'], series: [{ name: 'Tasks', values: [54, 28, 18] }], centerLabel: '100 tasks' }),
  scatter: () => ({ series: [{ name: 'Accounts', points: [{ x: 10, y: 22 }, { x: 18, y: 30 }, { x: 25, y: 41 }, { x: 33, y: 39 }, { x: 40, y: 55 }] }], xAxisTitle: 'Spend', yAxisTitle: 'Revenue' }),
  bubble: () => ({ series: [{ name: 'Markets', points: [{ x: 10, y: 20, size: 30, label: 'A' }, { x: 25, y: 35, size: 60, label: 'B' }, { x: 40, y: 18, size: 20, label: 'C' }] }] }),
  radar: () => ({ categories: ['Speed', 'Quality', 'Cost', 'Support', 'Scale'], series: [{ name: 'Us', values: [8, 9, 6, 9, 7] }, { name: 'Competitor', values: [6, 7, 8, 5, 6] }] }),
  waterfall: () => ({ categories: ['Start', 'Sales', 'Services', 'Costs', 'Tax', 'End'], series: [{ name: 'Cash', values: [100, 40, 15, -35, -10, 110] }], totals: [0, 5] }),
  funnel: () => ({ categories: ['Visitors', 'Sign-ups', 'Trials', 'Customers'], series: [{ name: 'Funnel', values: [10000, 2400, 900, 310] }] }),
  combo: () => ({ categories: ['Q1', 'Q2', 'Q3', 'Q4'], series: [{ name: 'Revenue', values: [120, 150, 170, 210], type: 'bar' }, { name: 'Margin %', values: [18, 21, 24, 26], type: 'line', axis: 'secondary' }] }),
  histogram: () => ({ series: [{ name: 'Response time (ms)', values: [120, 135, 150, 160, 162, 170, 180, 185, 190, 200, 205, 210, 230, 240, 260, 300, 320] }], bins: 6 }),
  treemap: () => ({ categories: ['Cloud', 'Devices', 'Services', 'Licensing', 'Other'], series: [{ name: 'Revenue', values: [48, 22, 15, 10, 5] }] }),
};

export const SAMPLE_DIAGRAM_ITEMS: Record<DiagramKind, () => Record<string, unknown>> = {
  process: () => ({ items: [{ title: 'Discover', text: 'Research needs' }, { title: 'Design', text: 'Prototype ideas' }, { title: 'Build', text: 'Ship increments' }, { title: 'Measure', text: 'Learn & iterate' }] }),
  chevronProcess: () => ({ items: [{ title: 'Plan' }, { title: 'Execute' }, { title: 'Review' }, { title: 'Scale' }] }),
  cycle: () => ({ center: 'Continuous improvement', items: [{ title: 'Plan', icon: 'target' }, { title: 'Do', icon: 'rocket' }, { title: 'Check', icon: 'search' }, { title: 'Act', icon: 'refresh-cw' }] }),
  pyramid: () => ({ items: [{ title: 'Vision', text: 'Why we exist' }, { title: 'Strategy', text: 'Where we play' }, { title: 'Execution', text: 'How we win' }] }),
  funnel: () => ({ items: [{ title: 'Awareness' }, { title: 'Interest' }, { title: 'Decision' }, { title: 'Action' }] }),
  flowchart: () => ({ nodes: [{ id: 'a', label: 'Start', shape: 'pill' }, { id: 'b', label: 'Validate input' }, { id: 'c', label: 'Valid?', shape: 'diamond' }, { id: 'd', label: 'Process' }, { id: 'e', label: 'Show error' }], edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'd', label: 'yes' }, { from: 'c', to: 'e', label: 'no' }] }),
  mindmap: () => ({ center: 'Product launch', items: [{ title: 'Marketing', children: [{ title: 'Campaign' }, { title: 'PR' }] }, { title: 'Sales', children: [{ title: 'Pricing' }, { title: 'Partners' }] }, { title: 'Product', children: [{ title: 'Beta' }, { title: 'Docs' }] }, { title: 'Support', children: [{ title: 'FAQ' }] }] }),
  orgchart: () => ({ items: [{ title: 'CEO', text: 'Alex Kim', children: [{ title: 'CTO', text: 'Sam Lee', children: [{ title: 'Platform' }, { title: 'Apps' }] }, { title: 'COO', text: 'Rae Park', children: [{ title: 'Ops' }] }, { title: 'CMO', text: 'Jo Tran' }] }] }),
  hierarchy: () => ({ items: [{ title: 'Goal', children: [{ title: 'Objective A', children: [{ title: 'Task 1' }, { title: 'Task 2' }] }, { title: 'Objective B', children: [{ title: 'Task 3' }] }] }] }),
  swot: () => ({ items: [{ title: 'Strengths', text: 'Loyal customers, strong brand' }, { title: 'Weaknesses', text: 'Limited channels' }, { title: 'Opportunities', text: 'New markets in Asia' }, { title: 'Threats', text: 'Price competition' }] }),
  comparison: () => ({ items: [{ title: 'Option A', text: 'Lower cost, slower rollout' }, { title: 'Option B', text: 'Higher cost, faster impact' }] }),
  beforeAfter: () => ({ items: [{ title: 'Manual reporting', text: '3 days per month' }, { title: 'Automated dashboards', text: 'Real-time, zero effort' }] }),
  roadmap: () => ({ items: [{ title: 'Alpha', value: 'Q1', status: 'done' }, { title: 'Beta', value: 'Q2', status: 'active' }, { title: 'Launch', value: 'Q3', status: 'planned' }, { title: 'Scale', value: 'Q4', status: 'planned' }] }),
  venn: () => ({ items: [{ title: 'Desirable' }, { title: 'Feasible' }, { title: 'Viable' }] }),
  matrix: () => ({ items: [{ title: 'Quick wins' }, { title: 'Major projects' }, { title: 'Fill-ins' }, { title: 'Thankless tasks' }], axes: { x: 'Effort', y: 'Impact' } }),
  hub: () => ({ center: 'Platform', items: [{ title: 'Web', icon: 'globe' }, { title: 'Mobile', icon: 'smartphone' }, { title: 'API', icon: 'code' }, { title: 'Data', icon: 'database' }, { title: 'AI', icon: 'brain' }] }),
  strategyMap: () => ({ items: [{ title: 'Financial', children: [{ title: 'Grow revenue' }, { title: 'Improve margin' }] }, { title: 'Customer', children: [{ title: 'Raise NPS' }, { title: 'Expand accounts' }] }, { title: 'Process', children: [{ title: 'Automate ops' }] }, { title: 'Learning', children: [{ title: 'Upskill teams' }] }] }),
  list: () => ({ items: [{ title: 'Clarity', text: 'One message per slide' }, { title: 'Contrast', text: 'Make the key number pop' }, { title: 'Consistency', text: 'Reuse the same grid' }] }),
};

export const SAMPLE_INFOGRAPHIC: Record<InfographicKind, () => Record<string, unknown>> = {
  kpiGrid: () => ({ items: [{ label: 'Revenue', value: '$4.2M', delta: '+18% YoY', trend: 'up', icon: 'dollar-sign' }, { label: 'Customers', value: '1,240', delta: '+9%', trend: 'up', icon: 'users' }, { label: 'Churn', value: '2.1%', delta: '-0.4 pt', trend: 'down', icon: 'trending-down' }, { label: 'NPS', value: '62', delta: '+5', trend: 'up', icon: 'smile' }] }),
  progressBars: () => ({ items: [{ label: 'Design', progress: 0.9 }, { label: 'Development', progress: 0.65 }, { label: 'Testing', progress: 0.3 }] }),
  statRings: () => ({ items: [{ label: 'Adoption', progress: 0.72 }, { label: 'Satisfaction', progress: 0.88 }, { label: 'Retention', progress: 0.64 }] }),
  numberedList: () => ({ items: [{ label: 'Define the problem', text: 'Start from user pain' }, { label: 'Size the opportunity', text: 'Quantify impact' }, { label: 'Pick a focus', text: 'Say no to the rest' }] }),
  iconList: () => ({ items: [{ label: 'Fast', icon: 'zap', text: 'Under 100 ms' }, { label: 'Secure', icon: 'shield-check', text: 'SOC 2 ready' }, { label: 'Global', icon: 'globe', text: '30 regions' }] }),
  pictogram: () => ({ items: [{ label: 'of people prefer visual summaries', value: 7 }], total: 10, icon: 'user' }),
  comparisonBars: () => ({ labels: ['2025', '2026'], items: [{ label: 'North', value: 40, compare: 55 }, { label: 'South', value: 30, compare: 34 }, { label: 'East', value: 22, compare: 41 }] }),
};

export function makeElement(kind: string, sub: string | undefined, size: { width: number; height: number }): Partial_ {
  switch (kind) {
    case 'heading': return { type: 'heading', ...centered(1200, 140, size), content: { text: 'Add a heading' }, style: { fontFamily: '$heading' } };
    case 'text': return { type: 'paragraph', ...centered(900, 120, size), content: { text: 'Add body text' } };
    case 'bullets': return { type: 'text', ...centered(900, 220, size), content: { text: '- First point\n- Second point\n- Third point' }, style: { paragraphSpacing: 12 } };
    case 'shape': return { type: 'shape', ...centered(sub === 'ellipse' || sub === 'star5' ? 360 : 480, sub === 'pill' ? 120 : 300, size), content: { shape: sub ?? 'rect' }, style: { fill: '$primary', radius: sub === 'roundRect' ? 24 : undefined } };
    case 'line': return { type: 'line', x: size.width / 2 - 300, y: size.height / 2, width: 600, height: 1, content: { x1: size.width / 2 - 300, y1: size.height / 2, x2: size.width / 2 + 300, y2: size.height / 2 }, style: { stroke: { color: '$text', width: 4 } } };
    case 'arrow': return { type: 'arrow', x: size.width / 2 - 300, y: size.height / 2, width: 600, height: 1, content: { x1: size.width / 2 - 300, y1: size.height / 2, x2: size.width / 2 + 300, y2: size.height / 2 }, style: { stroke: { color: '$accent', width: 6 }, headEnd: 'triangle' } };
    case 'image': return { type: 'image', ...centered(800, 500, size), content: { query: sub ?? 'modern office teamwork', alt: sub ?? 'Image' } };
    case 'icon': return { type: 'icon', ...centered(160, 160, size), content: { name: sub ?? 'star' }, style: { color: '$primary' } };
    case 'table': return { type: 'table', ...centered(1200, 400, size), content: { header: true, rows: [['Metric', '2025', '2026', 'Change'], ['Revenue', '$3.1M', '$4.2M', '+35%'], ['Customers', '980', '1,240', '+27%'], ['Churn', '2.5%', '2.1%', '-0.4 pt']] } };
    case 'chart': { const t = (sub ?? 'column') as ChartType; return { type: 'chart', ...centered(1200, 640, size), content: { chartType: t, title: '', ...SAMPLE_CHART_DATA[t](), source: 'Sample data — replace with your own' } }; }
    case 'diagram': { const k = (sub ?? 'process') as DiagramKind; return { type: 'diagram', ...centered(1500, 620, size), content: { kind: k, ...SAMPLE_DIAGRAM_ITEMS[k]() } }; }
    case 'smartart': { const k = (sub ?? 'list') as DiagramKind; return { type: 'smartart', ...centered(1300, 560, size), content: { kind: k, ...SAMPLE_DIAGRAM_ITEMS[k]() } }; }
    case 'timeline': return { type: 'timeline', ...centered(1600, 420, size), content: { orientation: 'horizontal', style: sub ?? 'milestones', items: [{ date: '2023', title: 'Founded', text: 'Two engineers, one idea' }, { date: '2024', title: 'First customers', text: '50 paying teams' }, { date: '2025', title: 'Series A', text: 'Expanded to 3 markets' }, { date: '2026', title: 'Platform', text: 'Open API launched', highlight: true }] } };
    case 'infographic': { const k = (sub ?? 'kpiGrid') as InfographicKind; return { type: 'infographic', ...centered(1500, 420, size), content: { kind: k, ...SAMPLE_INFOGRAPHIC[k]() } }; }
    case 'formula': return { type: 'formula', ...centered(1000, 220, size), content: { latex: sub ?? 'E = mc^2', display: true }, style: { fontSize: 64, color: '$text' } };
    case 'code': return { type: 'code', ...centered(1100, 460, size), content: { language: 'typescript', showLineNumbers: true, code: "export function greet(name: string) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('SlideCraft'));" }, style: { fontSize: 24 } };
    case 'video': return { type: 'video', ...centered(960, 540, size), content: { src: sub ?? 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', title: 'Video' } };
    case 'audio': return { type: 'audio', ...centered(560, 96, size), content: { src: sub ?? '', title: 'Audio clip' } };
    case 'decorative': return { type: 'decorative', ...centered(700, 700, size), content: { kind: sub ?? 'blob', colors: ['$primary', '$accent'] }, opacity: 0.9 };
    case 'visual3d': return { type: 'visual3d', ...centered(600, 520, size), content: { kind: sub ?? 'isometricStack', items: sub === 'isometricStack' || !sub ? ['Data', 'Logic', 'Interface'] : undefined } };
    case 'svg': return { type: 'svg', ...centered(400, 400, size), content: { markup: '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#6366f1"/></svg>' } };
    default: return { type: 'text', ...centered(800, 100, size), content: { text: 'Text' } };
  }
}
