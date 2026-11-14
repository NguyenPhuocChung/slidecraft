/* Sample 2 — Academic Presentation (15 slides). Illustrative study; data are illustrative. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;

export const academic: Raw = {
  schemaVersion: '1.0',
  id: 'sample-academic',
  title: 'Spaced Retrieval Practice in Undergraduate Statistics',
  description: 'Conference-style research talk on a (fictional) semester-long classroom study.',
  author: 'Dr. L. Moreau & Dr. K. Tan, Department of Psychology (fictional)',
  theme: 'academic-research',
  aspectRatio: '16:9',
  language: 'en',
  globalStyles: { defaultTransition: { type: 'fade', duration: 500 }, slideNumbers: true, footer: 'Moreau & Tan · Learning Sciences Colloquium 2026' },
  sections: [{ id: 'intro', title: 'Introduction' }, { id: 'method', title: 'Method' }, { id: 'results', title: 'Results' }, { id: 'discussion', title: 'Discussion' }],
  slides: [
    {
      id: 'ac-title', section: 'intro', layout: 'title',
      content: {
        eyebrow: 'Learning Sciences Colloquium · 2026',
        heading: 'Spaced Retrieval Practice in Undergraduate Statistics',
        subheading: 'A semester-long quasi-experiment with 412 students',
        body: 'L. Moreau · K. Tan — Department of Psychology',
      },
      notes: 'Thank the organizers. One-sentence summary: low-stakes spaced quizzes improved final-exam performance.',
    },
    {
      id: 'ac-agenda', section: 'intro', layout: 'agenda',
      content: {
        heading: 'Outline',
        items: [
          { title: 'Background', text: 'Testing effect and spacing effect' },
          { title: 'Research questions', text: 'Does spacing add value beyond retrieval?' },
          { title: 'Method', text: 'Design, participants, measures' },
          { title: 'Results', text: 'Exam scores, retention, engagement' },
          { title: 'Discussion', text: 'Limitations and implications for teaching' },
        ],
      },
      notes: 'About 20 minutes plus questions.',
    },
    {
      id: 'ac-background', section: 'intro', layout: 'twoColumns',
      content: {
        eyebrow: 'Background',
        heading: 'Two robust effects from cognitive psychology',
        columns: [
          { heading: 'Testing effect', body: 'Retrieving information strengthens memory more than re-reading it (Roediger & Karpicke, 2006).', bullets: ['Works with free recall and multiple choice', 'Benefits grow with longer delays'] },
          { heading: 'Spacing effect', body: 'Distributing practice over time beats massed practice (Cepeda et al., 2006).', bullets: ['Optimal gap depends on retention interval', 'Under-used in course design'] },
        ],
      },
      notes: 'Citations are the classic papers; the numbers in this talk come from our (illustrative) study.',
    },
    {
      id: 'ac-quote', section: 'intro', layout: 'quote',
      content: {
        quote: { text: 'Testing is not a neutral event: the act of retrieval changes memory.', author: 'Paraphrase of a common summary of the testing-effect literature', role: 'Learning-sciences textbooks' },
      },
      notes: 'Bridge to our research question.',
    },
    {
      id: 'ac-rq', section: 'intro', layout: 'cardGrid',
      content: {
        eyebrow: 'Research questions',
        heading: 'What we asked',
        items: [
          { title: 'RQ1', text: 'Do weekly spaced retrieval quizzes improve final-exam scores compared with massed review?' },
          { title: 'RQ2', text: 'Is the benefit still visible on a delayed retention test six weeks later?' },
          { title: 'RQ3', text: 'Does quiz engagement predict the size of the benefit?' },
          { title: 'RQ4', text: 'Do students perceive spaced quizzes as more effortful?' },
        ],
      },
      notes: 'RQ4 matters for adoption: desirable difficulties feel unpleasant.',
    },
    {
      id: 'ac-section-method', section: 'method', layout: 'sectionDivider',
      content: { number: '02', heading: 'Method', subheading: 'Quasi-experimental design across four course sections' },
    },
    {
      id: 'ac-design', section: 'method', layout: 'process',
      content: {
        heading: 'Study design',
        items: [
          { title: 'Baseline', text: 'Pre-test on probability basics (week 1)' },
          { title: 'Intervention', text: '12 weekly quizzes: spaced vs. massed schedule' },
          { title: 'Final exam', text: 'Common exam, blind-graded (week 14)' },
          { title: 'Retention', text: 'Delayed test six weeks after the course' },
        ],
      },
      notes: 'Sections were assigned to conditions by semester timetable, not randomly — hence quasi-experiment.',
    },
    {
      id: 'ac-participants', section: 'method', layout: 'tableFocus',
      content: {
        heading: 'Participants by condition',
        table: {
          rows: [
            ['Condition', 'Sections', 'Students (n)', 'Female (%)', 'Pre-test mean (SD)'],
            ['Spaced retrieval', '2', '207', '58', '61.2 (11.4)'],
            ['Massed review', '2', '205', '55', '60.8 (12.1)'],
            ['Total', '4', '412', '56.5', '61.0 (11.7)'],
          ],
          header: true, highlightRows: [3],
        },
        body: 'Groups did not differ at baseline, t(410) = 0.35, p = .73 (illustrative data).',
        caption: 'Table 1. Sample characteristics (illustrative data).',
      },
      notes: 'Baseline equivalence supports the comparison.',
    },
    {
      id: 'ac-model', section: 'method', title: 'Analysis model',
      elements: [
        { id: 'model-heading', type: 'heading', x: 120, y: 110, width: 1680, height: 100, content: { text: 'Analysis: linear mixed-effects model' }, style: { fontSize: 60 } },
        { id: 'model-formula', type: 'formula', x: 120, y: 280, width: 1680, height: 200, content: { latex: 'y_{ij} = \\beta_0 + \\beta_1\\,\\text{Spaced}_j + \\beta_2\\,\\text{Pre}_{ij} + u_{0j} + \\varepsilon_{ij}', display: true }, style: { fontSize: 60, color: '$text' }, animation: [{ effect: 'fadeIn', trigger: 'onEnter', duration: 700 }] },
        { id: 'model-effect', type: 'formula', x: 120, y: 520, width: 820, height: 160, content: { latex: 'd = \\frac{\\bar{x}_{S} - \\bar{x}_{M}}{s_{pooled}}', display: true }, style: { fontSize: 50, color: '$primary' }, animation: [{ effect: 'fadeIn', trigger: 'onClick', duration: 600 }] },
        { id: 'model-notes', type: 'paragraph', x: 1000, y: 520, width: 800, height: 380, content: { text: '- ==y==: final-exam score of student i in section j\n- ==u==: random intercept for course section\n- Pre-test score as covariate\n- Effect size reported as Cohen\'s ==d==' }, style: { fontSize: 30, color: '$text', paragraphSpacing: 14 }, animation: [{ effect: 'fadeIn', trigger: 'afterPrevious', duration: 500 }] },
      ],
      notes: 'Random intercepts account for instructor and timetable differences between sections.',
    },
    {
      id: 'ac-section-results', section: 'results', layout: 'sectionDivider',
      content: { number: '03', heading: 'Results', subheading: 'Exam performance, retention and engagement' },
    },
    {
      id: 'ac-exam', section: 'results', layout: 'dataStory',
      content: {
        heading: 'Spaced retrieval raised final-exam scores by about 6 points',
        chart: {
          chartType: 'column', categories: ['Probability', 'Inference', 'Regression', 'Overall'],
          series: [{ name: 'Spaced retrieval', values: [74.1, 70.3, 68.9, 71.2] }, { name: 'Massed review', values: [68.4, 63.9, 63.0, 65.1] }],
          valueSuffix: '%', showLabels: true, yAxisTitle: 'Mean score (%)', source: 'Moreau & Tan study (illustrative data)',
        },
        stats: [{ value: 'd = 0.48', label: 'Overall effect size, p < .001' }],
        body: 'The largest gain appeared in ==inference==, the most conceptually demanding unit.',
      },
      notes: 'Adjusted means from the mixed model; error bars omitted for readability.',
    },
    {
      id: 'ac-retention', section: 'results', layout: 'chartFocus',
      content: {
        heading: 'The advantage persisted six weeks later',
        chart: {
          chartType: 'line', categories: ['Week 4', 'Week 8', 'Week 14 (exam)', 'Week 20 (delayed)'],
          series: [{ name: 'Spaced retrieval', values: [63, 67, 71, 66] }, { name: 'Massed review', values: [62, 64, 65, 55] }],
          valueSuffix: '%', showLabels: true, source: 'Illustrative data',
        },
        caption: 'Figure 2. Mean percent correct on cumulative probes (illustrative data).',
      },
      notes: 'Forgetting slope is shallower in the spaced condition — consistent with spacing theory.',
    },
    {
      id: 'ac-history', section: 'discussion', layout: 'timeline',
      content: {
        heading: 'A century of evidence',
        timeline: {
          orientation: 'horizontal', style: 'milestones',
          items: [
            { date: '1885', title: 'Ebbinghaus', text: 'Forgetting curve and early spacing observations' },
            { date: '1917', title: 'Gates', text: 'Recitation improves recall of prose' },
            { date: '2006', title: 'Roediger & Karpicke', text: 'Testing effect in educational materials' },
            { date: '2006', title: 'Cepeda et al.', text: 'Meta-analysis of distributed practice' },
            { date: '2026', title: 'This study', text: 'Semester-long classroom test', highlight: true },
          ],
        },
      },
      notes: 'Our contribution: a full course, real grades, delayed retention.',
    },
    {
      id: 'ac-limitations', section: 'discussion', layout: 'asymmetric',
      content: {
        heading: 'Limitations',
        bullets: [
          'Sections, not students, were assigned to conditions',
          'Single institution and a single course',
          'Quiz engagement was self-paced and may reflect motivation',
          'Delayed test had 18% attrition (illustrative)',
        ],
      },
      notes: 'Be candid; invite replication.',
    },
    {
      id: 'ac-closing', section: 'discussion', layout: 'closing',
      content: {
        heading: 'Small, spaced quizzes — durable learning',
        body: 'Materials and analysis code available on request · l.moreau@university.example',
        footer: 'References: Cepeda et al. (2006). Psychological Bulletin, 132(3). Roediger & Karpicke (2006). Psychological Science, 17(3).',
      },
      notes: 'Questions.',
    },
  ],
};
