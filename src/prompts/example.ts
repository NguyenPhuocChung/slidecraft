/** Compact, fully valid example output used inside every prompt (unit-tested to import with 0 errors). */
export const EXAMPLE_INPUT = `Topic: Launching "Nimbus Notes", a note-taking app for students.
Key points: students lose 4 hours/week searching scattered notes (survey of 400 students we ran);
our app syncs notes, PDFs and lecture audio in one place; beta: 1,200 users, 38% weekly retention growth Jan→Apr
(Jan 21%, Feb 26%, Mar 33%, Apr 38%); roadmap: Beta (done), Campus pilots (Q3), Public launch (Q4).
Audience: university innovation fund. Language: English.`;

export const EXAMPLE_OUTPUT = {
  schemaVersion: '1.0',
  id: 'nimbus-notes-pitch',
  title: 'Nimbus Notes — One home for every study note',
  author: 'Nimbus team',
  aspectRatio: '16:9',
  theme: 'startup-pitch',
  language: 'en',
  slides: [
    {
      id: 's1-title',
      layout: 'hero',
      content: {
        eyebrow: 'Innovation Fund 2026',
        heading: 'One home for every study note',
        subheading: 'Nimbus Notes syncs notes, PDFs and lecture audio in one searchable place.',
        image: { query: 'university student studying with laptop and notebook', alt: 'Student studying with laptop' },
        cta: 'Back the campus pilot',
      },
      transition: { type: 'fade', duration: 700 },
      notes: 'Open with the promise, not the product.',
    },
    {
      id: 's2-problem',
      layout: 'bigNumber',
      content: { eyebrow: 'The problem', stats: [{ value: '4 h', label: 'lost every week searching scattered notes' }], body: 'Survey of 400 students run by the Nimbus team.' },
      transition: { type: 'push', direction: 'left', duration: 600 },
      notes: 'Pause on the number. This comes from our own survey of 400 students.',
    },
    {
      id: 's3-solution',
      title: 'How it works',
      background: { type: 'color', color: '$background' },
      elements: [
        { id: 'title', type: 'heading', x: 120, y: 96, width: 1200, height: 110, content: { text: 'How Nimbus works' }, style: { fontSize: 72 }, animation: [{ effect: 'fadeIn', trigger: 'onEnter', duration: 500 }] },
        { id: 'flow', type: 'diagram', x: 120, y: 280, width: 1680, height: 560, content: { kind: 'process', items: [{ title: 'Capture', text: 'Notes, PDFs, audio', icon: 'mic' }, { title: 'Sync', text: 'Every device', icon: 'refresh-cw' }, { title: 'Search', text: 'Find anything in seconds', icon: 'search' }] }, animation: [{ effect: 'wipe', direction: 'left', trigger: 'afterPrevious', duration: 900 }] },
        { id: 'badge', type: 'shape', x: 1500, y: 110, width: 300, height: 80, content: { shape: 'pill', text: '**Beta: 1,200 users**' }, style: { fill: '$accent', color: '#ffffff', fontSize: 26 }, animation: [{ effect: 'pop', trigger: 'onClick', duration: 500 }] },
      ],
      transition: { type: 'fade', duration: 600 },
      notes: 'Three verbs: capture, sync, search.',
    },
    {
      id: 's4-traction',
      layout: 'dataStory',
      content: {
        heading: 'Weekly retention grew every month of the beta',
        chart: { chartType: 'line', categories: ['Jan', 'Feb', 'Mar', 'Apr'], series: [{ name: 'Weekly retention', values: [21, 26, 33, 38] }], valueSuffix: '%', showLabels: true, source: 'Nimbus beta analytics' },
        stats: [{ value: '38%', label: 'weekly retention in April' }],
        body: 'Retention rose from 21% to 38% in four months as search improved.',
      },
      transition: { type: 'wipe', direction: 'left', duration: 700 },
      notes: 'Only real beta numbers are shown here.',
    },
    {
      id: 's5-roadmap-a',
      elements: [
        { id: 'rm-title', type: 'heading', x: 120, y: 100, width: 1400, height: 110, content: { text: 'Roadmap' }, style: { fontSize: 72 } },
        { id: 'rm-dot', type: 'shape', x: 120, y: 520, width: 120, height: 120, content: { shape: 'ellipse' }, style: { fill: '$primary' } },
        { id: 'rm-label', type: 'text', x: 280, y: 545, width: 900, height: 70, content: { text: '**Now:** Beta complete' }, style: { fontSize: 40 } },
      ],
      notes: 'The dot moves along the roadmap on the next slide (Morph).',
    },
    {
      id: 's6-roadmap-b',
      elements: [
        { id: 'rm-title', type: 'heading', x: 120, y: 100, width: 1400, height: 110, content: { text: 'Roadmap' }, style: { fontSize: 72 } },
        { id: 'rm-dot', type: 'shape', x: 1500, y: 470, width: 220, height: 220, content: { shape: 'ellipse' }, style: { fill: '$accent' } },
        { id: 'rm-label', type: 'text', x: 120, y: 545, width: 1300, height: 70, content: { text: '**Next:** Campus pilots (Q3) → Public launch (Q4)' }, style: { fontSize: 40 } },
      ],
      transition: { type: 'morph', duration: 1200 },
      notes: 'Morph animates the dot and label from the previous slide.',
    },
    {
      id: 's7-close',
      layout: 'closing',
      content: { heading: 'Help us reach every campus', body: 'Funding the Q3 pilots puts Nimbus in 5 universities.', cta: 'Back the pilot' },
      transition: { type: 'zoom', duration: 700 },
      notes: 'End with the ask.',
    },
  ],
};
