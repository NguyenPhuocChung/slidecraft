import type { Box } from './geometry';

export function Rulers({ scale, ox, oy, size, width, height, selection }: { scale: number; ox: number; oy: number; size: number; width: number; height: number; selection: Box | null }) {
  const step = [10, 20, 50, 100, 200, 500].find((s) => s * scale >= 48) ?? 1000;
  const ticksX: number[] = [];
  for (let v = Math.floor(-ox / scale / step) * step; v * scale + ox < width; v += step) ticksX.push(v);
  const ticksY: number[] = [];
  for (let v = Math.floor(-oy / scale / step) * step; v * scale + oy < height; v += step) ticksY.push(v);
  return (
    <>
      <svg className="pointer-events-none absolute left-0 top-0 z-10 bg-white/90 text-ink-400 dark:bg-ink-900/90" width={width} height={size} style={{ borderBottom: '1px solid rgba(127,127,127,.25)' }}>
        {selection && <rect x={ox + selection.x * scale} y={0} width={selection.width * scale} height={size} fill="rgba(99,102,241,0.18)" />}
        {ticksX.map((v) => (
          <g key={v} transform={`translate(${ox + v * scale},0)`}>
            <line y1={size * 0.45} y2={size} stroke="currentColor" />
            <text x={3} y={10} fontSize={9} fill="currentColor">{v}</text>
            {[1, 2, 3, 4].map((k) => <line key={k} x1={(k * step * scale) / 5} x2={(k * step * scale) / 5} y1={size * 0.75} y2={size} stroke="currentColor" opacity={0.5} />)}
          </g>
        ))}
      </svg>
      <svg className="pointer-events-none absolute left-0 top-0 z-10 bg-white/90 text-ink-400 dark:bg-ink-900/90" width={size} height={height} style={{ borderRight: '1px solid rgba(127,127,127,.25)' }}>
        {selection && <rect y={oy + selection.y * scale} x={0} height={selection.height * scale} width={size} fill="rgba(99,102,241,0.18)" />}
        {ticksY.map((v) => (
          <g key={v} transform={`translate(0,${oy + v * scale})`}>
            <line x1={size * 0.45} x2={size} stroke="currentColor" />
            <text x={2} y={-3} fontSize={9} fill="currentColor" transform="rotate(-90)" textAnchor="end">{v}</text>
            {[1, 2, 3, 4].map((k) => <line key={k} y1={(k * step * scale) / 5} y2={(k * step * scale) / 5} x1={size * 0.75} x2={size} stroke="currentColor" opacity={0.5} />)}
          </g>
        ))}
      </svg>
      <div className="absolute left-0 top-0 z-20 bg-white dark:bg-ink-900" style={{ width: size, height: size }} />
    </>
  );
}
