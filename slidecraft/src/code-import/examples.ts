import { SAMPLES, sampleCode } from '@/samples';
import { exampleOutputCode } from '@/prompts/generator';

export const TSX_EXAMPLE = `import { Presentation, Slide, Heading, Text, Image, Chart, Stack, Grid, Card, Quote, Notes } from 'slidecraft';

const growth = [21, 26, 33, 38];

export default function Deck() {
  return (
    <Presentation title="Nimbus Notes" theme="startup-pitch" aspectRatio="16:9">
      <Slide id="cover" layout="hero" content={{ eyebrow: 'Pitch 2026', heading: 'One home for every study note', image: { query: 'student studying laptop', alt: 'Student' } }} transition="fade" />
      <Slide id="why" transition={{ type: 'push', direction: 'left' }}>
        <Heading level={1} animation="fadeIn">Why students switch</Heading>
        <Grid y={300} columns={3} height={360} gap={40}>
          <Card icon="search" title="Find anything" text="Full-text search across notes, PDFs and audio" />
          <Card icon="refresh-cw" title="Always synced" text="Phone, laptop and tablet" />
          <Card icon="users" title="Study groups" text="Share notebooks in one tap" />
        </Grid>
        <Notes>Three reasons from our beta interviews.</Notes>
      </Slide>
      <Slide id="traction">
        <Heading level={2}>Weekly retention (beta)</Heading>
        <Chart type="line" x={120} y={260} width={1680} height={680} categories={['Jan', 'Feb', 'Mar', 'Apr']} series={[{ name: 'Retention', values: growth }]} valueSuffix="%" showLabels animation={{ effect: 'wipe', direction: 'left', trigger: 'afterPrevious' }} />
      </Slide>
      <Slide id="quote">
        <Stack x={160} y={260} width={1500}>
          <Quote author="Linh, 2nd-year student">I stopped losing my lecture notes the week I installed it.</Quote>
        </Stack>
      </Slide>
    </Presentation>
  );
}
`;

export const MARKDOWN_EXAMPLE = `---
title: Remote Work Playbook
theme: modern-corporate
---

# Remote Work Playbook
## How our team ships across 6 time zones

---
layout: statistics
# Results after one year
-
| | |
|---|---|

---
# Our principles
- Write it down: decisions live in docs, not calls
- Overlap 3 hours a day, protect the rest
- Default to async video for demos
<!-- notes: Mention the decision log template. -->

---
# What changed
> Meetings dropped 40% and nobody missed them.
> — Engineering survey, Q2

---
# Thank you
Questions? remote@example.com
`;

export const HTML_EXAMPLE = `<!doctype html>
<html>
<head><title>Coffee Market Brief</title></head>
<body>
  <section data-transition="fade">
    <h1>Coffee Market Brief</h1>
    <h3>What changed this quarter</h3>
  </section>
  <section data-layout="imageRight">
    <h2>Cold brew keeps growing</h2>
    <p>Ready-to-drink cold brew led growth in our stores.</p>
    <ul><li>Strongest in summer months</li><li>Younger customers buy it most</li></ul>
    <aside class="notes">Point at the summer peak.</aside>
  </section>
  <section>
    <h2>Top products</h2>
    <table>
      <tr><th>Product</th><th>Share</th></tr>
      <tr><td>Cold brew</td><td>34%</td></tr>
      <tr><td>Latte</td><td>29%</td></tr>
      <tr><td>Espresso</td><td>18%</td></tr>
    </table>
  </section>
</body>
</html>
`;

export interface ExampleEntry { id: string; label: string; vars?: Record<string, string | number>; format: string; code: () => string }
export const EXAMPLES: ExampleEntry[] = [
  { id: 'prompt-example', label: 'Prompt example (JSON, {n} slides)', vars: { n: 7 }, format: 'json', code: exampleOutputCode },
  ...SAMPLES.map((s) => ({ id: s.id, label: '{title} (JSON, {n} slides)', vars: { title: s.title, n: s.slideCount }, format: 'json', code: () => sampleCode(s.id) ?? '' })),
  { id: 'tsx', label: 'React TSX components', format: 'tsx', code: () => TSX_EXAMPLE },
  { id: 'markdown', label: 'Markdown (--- separated)', format: 'markdown', code: () => MARKDOWN_EXAMPLE },
  { id: 'html', label: 'HTML <section> slides', format: 'html', code: () => HTML_EXAMPLE },
];
