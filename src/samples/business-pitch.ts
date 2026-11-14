/* Sample 1 — Business Pitch Deck (10 slides). Fictional company; all figures illustrative. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

const fadeUp = (delay = 0, trigger = 'afterPrevious') => [{ effect: 'rise', trigger, duration: 600, delay, easing: 'easeOut' }];

export const businessPitch: Raw = {
  schemaVersion: '1.0',
  id: 'sample-business-pitch',
  title: 'Nimbus Analytics — Series A Pitch',
  description: 'Investor pitch for a fictional SaaS analytics startup. All numbers are illustrative.',
  author: 'Nimbus Analytics (fictional)',
  aspectRatio: '16:9',
  theme: 'startup-pitch',
  language: 'en',
  globalStyles: { defaultTransition: { type: 'fade', duration: 600 }, slideNumbers: true },
  slides: [
    {
      id: 'bp-cover',
      layout: 'hero',
      content: {
        eyebrow: 'Series A · 2026',
        heading: 'Analytics your whole team can actually use',
        subheading: 'Nimbus turns raw product data into plain-language answers in seconds.',
        image: { query: 'modern team analyzing dashboard on laptop bright office', alt: 'Team reviewing an analytics dashboard' },
        cta: 'nimbus.example',
      },
      transition: { type: 'fade', duration: 800 },
      notes: 'Open with the promise: analytics without a data team. Keep it under 30 seconds.',
    },
    {
      id: 'bp-problem',
      title: 'The problem',
      elements: [
        { id: 'p-eyebrow', type: 'text', x: 120, y: 120, width: 900, height: 40, content: { text: 'THE PROBLEM' }, style: { fontSize: 22, fontWeight: 700, color: '$accent', letterSpacing: 3 }, animation: [{ effect: 'fadeIn', trigger: 'onEnter', duration: 400 }] },
        { id: 'p-heading', type: 'heading', x: 120, y: 180, width: 1100, height: 230, content: { text: 'Every team has questions.\nOnly the data team has ==answers==.' }, style: { fontSize: 76 }, animation: fadeUp(0) },
        { id: 'p-stat-bg', type: 'shape', x: 1300, y: 160, width: 500, height: 760, content: { shape: 'roundRect' }, style: { fill: '$primary', radius: 32 }, animation: [{ effect: 'wipe', trigger: 'afterPrevious', direction: 'up', duration: 700 }] },
        { id: 'p-stat-value', type: 'heading', x: 1350, y: 260, width: 400, height: 170, content: { text: '9 days' }, style: { fontSize: 120, color: '#ffffff' }, animation: [{ effect: 'zoomIn', trigger: 'afterPrevious', duration: 500 }] },
        { id: 'p-stat-label', type: 'paragraph', x: 1350, y: 450, width: 400, height: 300, content: { text: 'average wait for an ad-hoc data request in the teams we interviewed (n = 64, illustrative).' }, style: { fontSize: 30, color: '#ffffff' }, animation: fadeUp(100) },
        { id: 'p-list', type: 'paragraph', x: 120, y: 470, width: 1050, height: 420, content: { text: '- Dashboards answer last quarter\'s questions, not today\'s\n- SQL is a bottleneck: 1 analyst for every 40 employees\n- Decisions get made on gut feeling while tickets wait in a queue' }, style: { fontSize: 34, color: '$text', paragraphSpacing: 22 }, animation: [{ effect: 'fadeIn', trigger: 'onClick', duration: 500, byParagraph: true }] },
      ],
      transition: { type: 'push', direction: 'left', duration: 700 },
      notes: 'Tell the story of Maya, a product manager waiting a week for a retention number.',
    },
    {
      id: 'bp-solution',
      layout: 'imageRight',
      content: {
        eyebrow: 'The solution',
        heading: 'Ask in plain English. Get a chart, an answer and the SQL behind it.',
        bullets: ['Connects to Postgres, BigQuery and Snowflake in minutes', 'Every answer shows its query — fully auditable', 'Learns your metric definitions, so “active user” means one thing'],
        image: { query: 'clean analytics software interface chart on screen', alt: 'Nimbus product interface' },
        caption: 'Product screenshot (concept)',
      },
      notes: 'Emphasize trust: we never hide the SQL.',
    },
    {
      id: 'bp-traction',
      layout: 'statistics',
      content: {
        eyebrow: 'Traction',
        heading: 'Fourteen months after launch',
        stats: [
          { value: '$2.4M', label: 'Annual recurring revenue', text: 'Up from $0.3M a year ago' },
          { value: '186', label: 'Paying companies', text: '41% from inbound referrals' },
          { value: '128%', label: 'Net revenue retention', text: 'Customers expand seat count' },
        ],
        body: 'Illustrative figures for a fictional company.',
      },
      transition: { type: 'zoom', duration: 700 },
      notes: 'Pause after NRR — it is the strongest signal of product value.',
    },
    {
      id: 'bp-growth',
      layout: 'dataStory',
      content: {
        heading: 'Revenue has grown every month since launch',
        chart: {
          chartType: 'combo',
          categories: ['Q1 25', 'Q2 25', 'Q3 25', 'Q4 25', 'Q1 26', 'Q2 26'],
          series: [
            { name: 'ARR ($K)', values: [310, 520, 840, 1230, 1780, 2400], type: 'bar' },
            { name: 'Paying customers', values: [22, 41, 70, 104, 142, 186], type: 'line', axis: 'secondary' },
          ],
          showLegend: true,
          source: 'Nimbus internal metrics (illustrative data)',
        },
        stats: [{ value: '+35%', label: 'Quarter-over-quarter ARR growth' }],
        body: 'Growth is driven by ==seat expansion==: teams start with 5 seats and average 23 after six months.',
      },
      notes: 'Point to the line crossing — customer count and ARR grow together, not just price increases.',
    },
    {
      id: 'bp-market-a',
      title: 'Market',
      elements: [
        { id: 'mk-title', type: 'heading', x: 120, y: 110, width: 1680, height: 110, content: { text: 'A large market moving to self-serve' }, style: { fontSize: 64 } },
        { id: 'mk-tam', type: 'shape', x: 560, y: 260, width: 800, height: 760, content: { shape: 'ellipse', text: 'TAM\n$38B' }, style: { fill: '$surface', color: '$primary', fontSize: 40, fontWeight: 700, verticalAlign: 'top', padding: [60, 20, 20, 20] } },
        { id: 'mk-sam', type: 'shape', x: 710, y: 470, width: 500, height: 500, content: { shape: 'ellipse', text: 'SAM\n$9B' }, style: { fill: '$secondary', color: '#ffffff', fontSize: 36, fontWeight: 700, verticalAlign: 'top', padding: [50, 20, 20, 20] } },
        { id: 'mk-som', type: 'shape', x: 835, y: 690, width: 250, height: 250, content: { shape: 'ellipse', text: 'SOM\n$420M' }, style: { fill: '$accent', color: '#ffffff', fontSize: 30, fontWeight: 700 } },
        { id: 'mk-note', type: 'paragraph', x: 120, y: 960, width: 900, height: 60, content: { text: 'Illustrative market sizing for a fictional company.' }, style: { fontSize: 20, color: '$textMuted' } },
      ],
      transition: { type: 'fade', duration: 600 },
      notes: 'Next slide zooms into the serviceable market with a Morph transition.',
    },
    {
      id: 'bp-market-b',
      title: 'Where we start',
      elements: [
        { id: 'mk-title', type: 'heading', x: 120, y: 110, width: 1000, height: 110, content: { text: 'We start with mid-market SaaS' }, style: { fontSize: 64 } },
        { id: 'mk-tam', type: 'shape', x: 1500, y: 120, width: 300, height: 285, content: { shape: 'ellipse', text: 'TAM\n$38B' }, style: { fill: '$surface', color: '$primary', fontSize: 26, fontWeight: 700 } },
        { id: 'mk-sam', type: 'shape', x: 120, y: 300, width: 680, height: 680, content: { shape: 'ellipse', text: 'SAM\n$9B' }, style: { fill: '$secondary', color: '#ffffff', fontSize: 52, fontWeight: 700 } },
        { id: 'mk-som', type: 'shape', x: 600, y: 700, width: 280, height: 280, content: { shape: 'ellipse', text: 'SOM\n$420M' }, style: { fill: '$accent', color: '#ffffff', fontSize: 32, fontWeight: 700 } },
        { id: 'mk-points', type: 'paragraph', x: 980, y: 420, width: 820, height: 480, content: { text: '- 48,000 SaaS companies with 50–1,000 employees\n- Already pay for a warehouse, rarely staff a data team\n- Buy bottom-up: a product team trial becomes a company plan' }, style: { fontSize: 34, color: '$text', paragraphSpacing: 24 }, animation: [{ effect: 'fadeIn', trigger: 'afterPrevious', delay: 300, duration: 600 }] },
      ],
      transition: { type: 'morph', duration: 1200 },
      notes: 'Morph moves the market circles: the shared ids mk-tam, mk-sam and mk-som animate between the two slides.',
    },
    {
      id: 'bp-business-model',
      layout: 'threeColumns',
      content: {
        eyebrow: 'Business model',
        heading: 'Simple seat-based pricing that grows with usage',
        items: [
          { title: 'Team · $29/seat', text: 'Up to 25 seats, two data sources, community support.', icon: 'users' },
          { title: 'Business · $59/seat', text: 'Unlimited sources, SSO, governed metrics layer.', icon: 'building' },
          { title: 'Enterprise · custom', text: 'Private deployment, audit logs, dedicated success manager.', icon: 'shield-check' },
        ],
      },
      transition: { type: 'wipe', direction: 'left', duration: 600 },
      notes: '78% of revenue is Business tier (illustrative).',
    },
    {
      id: 'bp-ask',
      title: 'The ask',
      background: { type: 'gradient', gradient: { type: 'linear', angle: 135, stops: [{ color: '#5b21b6', offset: 0 }, { color: '#fb7185', offset: 1 }] } },
      elements: [
        { id: 'ask-eyebrow', type: 'text', x: 120, y: 150, width: 800, height: 40, content: { text: 'THE ASK' }, style: { fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: 4 } },
        { id: 'ask-amount', type: 'heading', x: 120, y: 210, width: 900, height: 230, content: { text: '$12M Series A' }, style: { fontSize: 140, color: '#ffffff' }, animation: [{ effect: 'zoomIn', trigger: 'onEnter', duration: 700, easing: 'backOut' }] },
        { id: 'ask-sub', type: 'paragraph', x: 120, y: 460, width: 820, height: 140, content: { text: 'to reach $10M ARR in 24 months.' }, style: { fontSize: 40, color: '#ffffff' }, animation: fadeUp(0) },
        { id: 'ask-chart', type: 'chart', x: 1040, y: 160, width: 760, height: 760, content: { chartType: 'donut', categories: ['Product & engineering', 'Go-to-market', 'Customer success', 'G&A'], series: [{ name: 'Use of funds', values: [50, 30, 12, 8] }], centerLabel: '$12M', valueSuffix: '%', showLegend: true, source: 'Illustrative data' }, animation: [{ effect: 'grow', trigger: 'onClick', duration: 800 }] },
      ],
      transition: { type: 'cover', direction: 'up', duration: 700 },
      notes: 'Walk through use of funds clockwise starting with engineering.',
    },
    {
      id: 'bp-closing',
      layout: 'closing',
      content: {
        heading: 'Let’s make every team data-fluent.',
        subheading: 'Maya Chen, CEO · maya@nimbus.example',
        cta: 'Book a product demo',
      },
      transition: { type: 'fade', duration: 900 },
      notes: 'Thank investors, invite questions, mention the data room.',
    },
  ],
};
