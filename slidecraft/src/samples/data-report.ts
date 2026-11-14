/* Sample 5 — Data Report (15 slides). Fictional company; all figures illustrative. */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Raw = Record<string, any>;
const SRC = 'Finance & BI, Northwind Retail (illustrative data)';

export const dataReport: Raw = {
  schemaVersion: '1.0',
  id: 'sample-data-report',
  title: 'Northwind Retail — FY2026 Performance Review',
  description: 'Annual data report for a fictional retailer: KPIs, dashboard and data storytelling.',
  author: 'Northwind Retail Finance & BI (fictional)',
  theme: 'financial-report',
  aspectRatio: '16:9',
  language: 'en',
  globalStyles: { defaultTransition: { type: 'fade', duration: 400 }, slideNumbers: true, footer: 'Northwind Retail · FY2026 Review · Illustrative data' },
  slides: [
    {
      id: 'dr-title', layout: 'title',
      content: { eyebrow: 'Board meeting · January 2027', heading: 'FY2026 Performance Review', subheading: 'Revenue, margin, customers and what we do next', body: 'Prepared by Finance & Business Intelligence' },
      notes: 'All numbers in this deck are illustrative for a fictional company.',
    },
    {
      id: 'dr-summary', title: 'Executive summary',
      elements: [
        { id: 'sum-heading', type: 'heading', x: 120, y: 100, width: 1680, height: 100, content: { text: 'Executive summary' }, style: { fontSize: 60 } },
        { id: 'sum-kpis', type: 'infographic', x: 120, y: 250, width: 1680, height: 420, content: { kind: 'kpiGrid', columns: 4, items: [
          { label: 'Net revenue', value: '$842M', delta: '+11.4% YoY', trend: 'up', icon: 'banknote' },
          { label: 'Gross margin', value: '38.6%', delta: '+1.2 pts', trend: 'up', icon: 'percent' },
          { label: 'Active customers', value: '4.9M', delta: '+6.0% YoY', trend: 'up', icon: 'users' },
          { label: 'Inventory days', value: '71', delta: '+5 days', trend: 'down', icon: 'warehouse' },
        ] }, animation: [{ effect: 'rise', trigger: 'onEnter', duration: 700 }] },
        { id: 'sum-text', type: 'paragraph', x: 120, y: 730, width: 1680, height: 250, content: { text: '- Growth came from ==online== (+24%) while stores held flat\n- Margin improved on private-label mix; freight costs eased in H2\n- Inventory build-up in Q4 is the main risk for FY2027' }, style: { fontSize: 32, color: '$text', paragraphSpacing: 16 }, animation: [{ effect: 'fadeIn', trigger: 'onClick', duration: 500 }] },
      ],
      notes: 'Three messages: online growth, better margin, inventory risk.',
    },
    {
      id: 'dr-agenda', layout: 'agenda',
      content: { heading: 'Contents', items: [{ title: 'Revenue' }, { title: 'Profitability' }, { title: 'Customers & funnel' }, { title: 'Operations' }, { title: 'Outlook' }] },
    },
    {
      id: 'dr-revenue-trend', layout: 'dataStory',
      content: {
        heading: 'Online overtook stores in Q4 for the first time',
        chart: {
          chartType: 'area', categories: ['Q1', 'Q2', 'Q3', 'Q4'], smooth: true,
          series: [{ name: 'Stores ($M)', values: [118, 112, 109, 121] }, { name: 'Online ($M)', values: [82, 95, 104, 128] }],
          showLegend: true, valuePrefix: '$', valueSuffix: 'M', source: SRC,
        },
        stats: [{ value: '51%', label: 'Online share of Q4 revenue' }],
        body: 'The crossover happened during the holiday quarter, driven by app orders with in-store pickup.',
      },
      notes: 'Note pickup orders are counted as online.',
    },
    {
      id: 'dr-revenue-bridge', layout: 'chartFocus',
      content: {
        heading: 'Revenue bridge: FY2025 to FY2026 ($M)',
        chart: {
          chartType: 'waterfall', categories: ['FY2025', 'Online growth', 'Store traffic', 'Pricing', 'Returns', 'FY2026'],
          series: [{ name: 'Revenue', values: [756, 92, -18, 31, -19, 842] }], totals: [0, 5], valuePrefix: '$', source: SRC,
        },
        caption: 'Bars between totals show year-over-year contributions.',
      },
      notes: 'Pricing was a smaller contributor than volume.',
    },
    {
      id: 'dr-category-mix', layout: 'chartFocus',
      content: {
        heading: 'Revenue by category',
        chart: {
          chartType: 'treemap', categories: ['Home', 'Apparel', 'Electronics', 'Grocery', 'Beauty', 'Toys', 'Garden', 'Sports'],
          series: [{ name: 'Revenue ($M)', values: [214, 168, 141, 109, 72, 58, 46, 34] }], valuePrefix: '$', valueSuffix: 'M', source: SRC,
        },
      },
      transition: { type: 'zoom', duration: 600 },
      notes: 'Home and Apparel are half of revenue.',
    },
    {
      id: 'dr-section-profit', layout: 'sectionDivider',
      content: { number: '02', heading: 'Profitability', subheading: 'Margin expansion and cost discipline' },
    },
    {
      id: 'dr-margin', layout: 'chartFocus',
      content: {
        heading: 'Revenue grew while gross margin expanded',
        chart: {
          chartType: 'combo', categories: ['Q1', 'Q2', 'Q3', 'Q4'],
          series: [
            { name: 'Revenue ($M)', values: [200, 207, 213, 249], type: 'bar' },
            { name: 'Gross margin (%)', values: [37.4, 38.1, 38.9, 39.6], type: 'line', axis: 'secondary' },
          ],
          showLegend: true, source: SRC,
        },
      },
      notes: 'Secondary axis shows margin percentage.',
    },
    {
      id: 'dr-pnl', layout: 'tableFocus',
      content: {
        heading: 'Summary P&L',
        table: {
          rows: [
            ['$M', 'FY2025', 'FY2026', 'Change'],
            ['Net revenue', '756', '842', '+11.4%'],
            ['Gross profit', '283', '325', '+14.8%'],
            ['Operating expenses', '214', '236', '+10.3%'],
            ['EBITDA', '96', '118', '+22.9%'],
            ['Net income', '41', '55', '+34.1%'],
          ],
          header: true, firstColumn: true, highlightRows: [4], columnWidths: [2, 1, 1, 1],
        },
        body: 'Operating leverage: opex grew slower than revenue, lifting EBITDA margin to ==14.0%==.',
        caption: 'Unaudited, illustrative figures.',
      },
      notes: 'Walk down the P&L from revenue to net income.',
    },
    {
      id: 'dr-section-customers', layout: 'sectionDivider',
      content: { number: '03', heading: 'Customers', subheading: 'Acquisition, conversion and loyalty' },
    },
    {
      id: 'dr-funnel', layout: 'dataStory',
      content: {
        heading: 'Checkout is now the biggest leak in the online funnel',
        chart: {
          chartType: 'funnel', categories: ['Sessions', 'Product views', 'Add to cart', 'Checkout', 'Purchase'],
          series: [{ name: 'Visitors (K)', values: [41200, 18900, 5200, 2600, 1480] }], source: SRC,
        },
        bullets: ['Only 57% of checkouts complete', 'Guest checkout launch planned for Q2', 'Target: +8 pts completion'],
      },
      notes: 'The funnel shows step-to-step conversion next to each stage.',
    },
    {
      id: 'dr-loyalty', layout: 'chartFocus',
      content: {
        heading: 'Loyalty members spend more and visit more often',
        chart: {
          chartType: 'bubble', xAxisTitle: 'Visits per year', yAxisTitle: 'Average basket ($)',
          series: [
            { name: 'Non-members', points: [{ x: 4, y: 38, size: 2.1, label: 'Casual' }, { x: 7, y: 44, size: 1.4, label: 'Regular' }] },
            { name: 'Members', points: [{ x: 11, y: 52, size: 0.9, label: 'Silver' }, { x: 18, y: 61, size: 0.4, label: 'Gold' }, { x: 26, y: 74, size: 0.15, label: 'Platinum' }] },
          ],
          showLegend: true, showLabels: true, source: SRC,
        },
        caption: 'Bubble size = customers (millions).',
      },
      notes: 'Platinum members are tiny in count but valuable.',
    },
    {
      id: 'dr-dashboard', layout: 'dashboard',
      content: {
        heading: 'Operations dashboard — Q4',
        stats: [
          { value: '96.2%', label: 'On-time delivery', text: '+1.8 pts', trend: 'up' },
          { value: '71 days', label: 'Inventory days', text: '+5 days', trend: 'down' },
          { value: '4.6 / 5', label: 'Store NPS proxy', text: 'flat', trend: 'flat' },
        ],
        chart: {
          chartType: 'line', categories: ['Oct', 'Nov', 'Dec'],
          series: [{ name: 'Orders shipped (K)', values: [412, 538, 701] }, { name: 'Late orders (K)', values: [14, 22, 31] }],
          showLegend: true, source: SRC,
        },
        table: { rows: [['Warehouse', 'Utilization'], ['North', '91%'], ['Central', '84%'], ['South', '97%']], header: true },
      },
      transition: { type: 'push', direction: 'left', duration: 600 },
      notes: 'South warehouse is near capacity.',
    },
    {
      id: 'dr-stores', layout: 'chartFocus',
      content: {
        heading: 'Larger stores are not more profitable per square meter',
        chart: {
          chartType: 'scatter', xAxisTitle: 'Store size (thousand m²)', yAxisTitle: 'Operating profit per m² ($)',
          series: [{ name: 'Stores', points: [{ x: 1.2, y: 410 }, { x: 1.8, y: 455 }, { x: 2.1, y: 390 }, { x: 2.6, y: 430 }, { x: 3.0, y: 360 }, { x: 3.4, y: 405 }, { x: 4.1, y: 340 }, { x: 4.8, y: 310 }, { x: 5.5, y: 295 }, { x: 6.2, y: 280 }] }],
          source: SRC,
        },
        caption: 'Each dot is one store (sample of 10).',
      },
      notes: 'Supports the shift to smaller-format stores.',
    },
    {
      id: 'dr-outlook', layout: 'closing',
      content: {
        heading: 'FY2027 priorities',
        body: '1. Fix checkout completion  ·  2. Reduce inventory to 60 days  ·  3. Open 8 small-format stores',
        cta: 'Approve FY2027 plan',
      },
      notes: 'Ask for board approval of the plan.',
    },
  ],
};
