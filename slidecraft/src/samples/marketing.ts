/* Sample 4 — Marketing Presentation (10 slides). Fictional brand; data illustrative. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export const marketing: Raw = {
  schemaVersion: '1.0',
  id: 'sample-marketing',
  title: 'Verdant Run — Spring Launch Campaign',
  description: 'Campaign plan for a fictional sustainable running-shoe brand.',
  author: 'Verdant Run Marketing (fictional)',
  theme: 'marketing-campaign',
  aspectRatio: '16:9',
  language: 'en',
  slides: [
    {
      id: 'mk-cover', layout: 'fullImage',
      content: {
        eyebrow: 'Spring Launch 2027',
        heading: 'Run lighter. Leave less behind.',
        subheading: 'Campaign plan for the Verdant Pulse — our first fully recyclable running shoe.',
        image: { query: 'runner on mountain trail at sunrise', alt: 'Runner on a mountain trail at sunrise' },
        caption: 'Verdant Run · Brand & Growth team',
      },
      transition: { type: 'fade', duration: 900 },
      notes: 'Let the image breathe for a moment before speaking.',
    },
    {
      id: 'mk-insight', layout: 'minimalType',
      content: {
        eyebrow: 'Consumer insight',
        heading: 'Runners care about the planet — but they won’t trade away performance.',
        subheading: 'From 1,200 survey responses in our community panel (illustrative).',
      },
      transition: { type: 'push', direction: 'up', duration: 700 },
      notes: 'This tension is the heart of the creative idea.',
    },
    {
      id: 'mk-product', layout: 'productShowcase',
      content: {
        heading: 'Verdant Pulse',
        image: { query: 'green running shoe product photo white background', alt: 'Verdant Pulse running shoe' },
        items: [
          { title: '212 g', text: 'Lighter than our previous trainer' },
          { title: 'Bio-foam midsole', text: '38% plant-based, same rebound' },
          { title: 'Mono-material upper', text: 'Recycled into new shoes' },
          { title: 'Take-back program', text: 'Return worn pairs for credit' },
        ],
      },
      notes: 'Specs are product targets for a fictional shoe.',
    },
    {
      id: 'mk-bento', layout: 'bento',
      content: {
        heading: 'Why it will win',
        image: { query: 'group of friends running in city park', alt: 'Friends running together in a park' },
        stats: [{ value: '64%', label: 'of panel would pay more for recyclable shoes' }],
        items: [
          { title: 'Community first', text: 'Launch through 40 local run clubs', icon: 'users' },
          { title: 'Proof, not promises', text: 'Lab-verified recyclability report', icon: 'badge-check' },
          { title: 'Circular by design', text: 'Every pair can come back', icon: 'recycle' },
        ],
      },
      transition: { type: 'zoom', duration: 700 },
      notes: 'The bento tiles map to the three pillars of the plan.',
    },
    {
      id: 'mk-audience', layout: 'statistics',
      content: {
        eyebrow: 'Audience',
        heading: 'Who we are talking to',
        stats: [
          { value: '25–40', label: 'Core age range', text: 'Urban runners, 3+ runs a week' },
          { value: '2.1M', label: 'Reachable audience', text: 'Across our target cities' },
          { value: '3.4×', label: 'Higher repurchase', text: 'Club members vs. casual buyers' },
          { value: '58%', label: 'Mobile-first shoppers', text: 'Buy within the app' },
        ],
      },
      notes: 'Illustrative audience figures.',
    },
    {
      id: 'mk-comparison', layout: 'comparison',
      content: {
        heading: 'Positioning against typical performance shoes',
        columns: [
          { heading: 'Typical performance shoe', bullets: ['Petroleum-based foams', 'Glued multi-material upper', 'Ends in landfill', 'Sustainability as a side note'] },
          { heading: 'Verdant Pulse', bullets: ['Plant-based bio-foam', 'Single-material, glue-free', 'Take-back and recycle', 'Performance and planet together'] },
        ],
      },
      transition: { type: 'split', direction: 'vertical', duration: 700 },
      notes: 'Avoid naming competitors; keep it category-level.',
    },
    {
      id: 'mk-big-idea', title: 'The big idea',
      background: { type: 'color', color: '$secondary' },
      elements: [
        { id: 'idea-image', type: 'image', x: 980, y: 0, width: 940, height: 1080, content: { query: 'close up running shoes on wet asphalt', alt: 'Close-up of running shoes on wet asphalt' }, style: { fit: 'cover' }, animation: [{ effect: 'reveal', trigger: 'onEnter', direction: 'left', duration: 900 }] },
        { id: 'idea-eyebrow', type: 'text', x: 120, y: 260, width: 760, height: 40, content: { text: 'THE BIG IDEA' }, style: { fontSize: 22, fontWeight: 700, color: '$accent', letterSpacing: 4 } },
        { id: 'idea-heading', type: 'heading', x: 120, y: 320, width: 800, height: 360, content: { text: 'Every kilometer\ncounts twice.' }, style: { fontSize: 104, color: '#ffffff', lineHeight: 1 }, animation: [{ effect: 'rise', trigger: 'afterPrevious', duration: 700 }] },
        { id: 'idea-body', type: 'paragraph', x: 120, y: 720, width: 760, height: 200, content: { text: 'For each kilometer logged in the Verdant app during launch month, we fund ==1 m²== of urban tree planting with a partner charity.' }, style: { fontSize: 32, color: '#ffffff' }, animation: [{ effect: 'fadeIn', trigger: 'onClick', duration: 600 }] },
      ],
      transition: { type: 'reveal', direction: 'left', duration: 800 },
      notes: 'The pledge mechanic turns runs into visible impact.',
    },
    {
      id: 'mk-channels', layout: 'dataStory',
      content: {
        heading: 'Budget is weighted toward community and creators',
        chart: {
          chartType: 'donut', categories: ['Creators', 'Run clubs & events', 'Paid social', 'Retail media', 'PR'],
          series: [{ name: 'Budget share', values: [32, 26, 22, 12, 8] }], valueSuffix: '%', centerLabel: '$1.8M', source: 'Campaign plan (illustrative data)',
        },
        bullets: ['58% of spend goes to people runners already trust', 'Paid social retargets app sign-ups', 'PR anchored on the recyclability report'],
      },
      notes: 'Total budget is illustrative.',
    },
    {
      id: 'mk-timeline', layout: 'timeline',
      content: {
        heading: 'Launch timeline',
        timeline: {
          orientation: 'horizontal', style: 'alternating',
          items: [
            { date: 'Feb', title: 'Teaser', text: 'Creator seeding, waitlist' },
            { date: 'Mar 1', title: 'Launch day', text: 'Run-club events in 12 cities', highlight: true },
            { date: 'Mar', title: 'Kilometer pledge', text: 'App challenge goes live' },
            { date: 'Apr', title: 'Impact report', text: 'Trees funded, km logged' },
            { date: 'May', title: 'Take-back', text: 'First returns recycled' },
          ],
        },
      },
      notes: 'Launch day is the highest-risk moment; we have weather contingencies.',
    },
    {
      id: 'mk-closing', layout: 'closing',
      content: {
        heading: 'Let’s run it.',
        body: 'Decision needed today: approve the $1.8M plan and the creator shortlist.',
        cta: 'Approve the launch plan',
        image: { query: 'smiling runner finish line', alt: 'Smiling runner crossing a finish line' },
      },
      transition: { type: 'fade', duration: 700 },
      notes: 'End with the decision request.',
    },
  ],
};
