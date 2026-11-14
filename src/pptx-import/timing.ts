/** <p:timing> main sequence → SlideCraft animations (per element), plus <p:transition> → Transition. */
import type { Animation, Transition } from '@/types/schema';
import { ANIMATION_EFFECTS } from '@/types/registry';
import { attr, child, children, find, findAll, kids, num, resolveAlternate, type XNode } from './xml';

type Effect = Animation['effect'];

/** presetClass:presetID → effect (first registry entry wins = canonical), plus common PowerPoint presets. */
const PRESET_MAP: Record<string, Effect> = (() => {
  const m: Record<string, Effect> = {};
  for (const [id, info] of Object.entries(ANIMATION_EFFECTS) as [Effect, { ppt?: { presetID: number; presetClass: string } }][]) {
    if (!info.ppt || info.ppt.presetClass === 'path') continue;
    const k = `${info.ppt.presetClass}:${info.ppt.presetID}`;
    if (!m[k]) m[k] = id;
  }
  m['emph:6'] = 'growShrink';
  Object.assign(m, {
    'entr:3': 'wipe', 'entr:12': 'flyIn', 'entr:47': 'rise', 'entr:26': 'bounce', 'entr:23': 'zoomIn', 'entr:21': 'zoomIn', 'entr:18': 'wipe', 'entr:9': 'fadeIn', 'entr:14': 'appear', 'entr:37': 'rise', 'entr:31': 'grow', 'entr:45': 'fadeIn', 'entr:49': 'rotateIn', 'entr:4': 'zoomIn', 'entr:5': 'wipe',
    'exit:47': 'fadeOut', 'exit:12': 'flyOut', 'exit:23': 'zoomOut', 'exit:21': 'zoomOut', 'exit:9': 'fadeOut', 'exit:3': 'wipeOut', 'exit:4': 'zoomOut', 'exit:1': 'fadeOut', 'exit:42': 'fadeOut',
    'emph:27': 'flash', 'emph:35': 'flash', 'emph:36': 'flash', 'emph:7': 'colorChange', 'emph:1': 'colorChange', 'emph:3': 'colorChange', 'emph:26': 'flash',
  } as Record<string, Effect>);
  return m;
})();

const FLY_DIR: Record<number, string> = { 8: 'left', 2: 'right', 1: 'up', 4: 'down', 9: 'left', 12: 'left', 3: 'right', 6: 'right' };
const WIPE_DIR: Record<number, string> = { 8: 'left', 2: 'right', 4: 'up', 1: 'down' };

function behaviorDuration(effect: XNode): number {
  let best = 0;
  for (const c of findAll(effect, 'cTn')) {
    if (c === effect) continue;
    const d = attr(c, 'dur');
    if (d && d !== 'indefinite') best = Math.max(best, num(d));
  }
  return best > 1 ? best : 500;
}

/** PowerPoint motion path (slide fractions) → SVG path in px relative to the element. */
function motionD(pathStr: string, W: number, H: number): string {
  const tokens = pathStr.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const out: string[] = [];
  let axis = 0;
  for (const t of tokens) {
    if (/^[a-zA-Z]$/.test(t)) { if (t === 'E' || t === 'e') break; out.push(t.toUpperCase()); axis = 0; continue; }
    const v = Number(t);
    out.push(String(Math.round((axis % 2 === 0 ? v * W : v * H) * 10) / 10));
    axis++;
  }
  return out.join(' ');
}

export interface ParsedAnimation { spid: string; anim: Animation }

export function parseTiming(sld: XNode, size: { width: number; height: number }, notes: string[]): ParsedAnimation[] {
  const timing = child(sld, 'timing');
  if (!timing) return [];
  const mainSeq = findAll(timing, 'cTn').find((c) => attr(c, 'nodeType') === 'mainSeq');
  if (!mainSeq) {
    if (find(timing, 'seq')) notes.push('Triggered (interactive) animations are not imported.');
    return [];
  }
  const out: ParsedAnimation[] = [];
  let first = true;
  const outerPars = children(child(mainSeq, 'childTnLst'), 'par');
  for (const outer of outerPars) {
    const oc = child(outer, 'cTn');
    const conds = children(child(oc, 'stCondLst'), 'cond');
    const auto = conds.some((c) => attr(c, 'evt') === 'onBegin') || (conds.length > 0 && conds.every((c) => attr(c, 'delay') !== 'indefinite'));
    let prevStart = 0, prevEnd = 0, k = 0;
    for (const sub of children(child(oc, 'childTnLst'), 'par')) {
      const sc = child(sub, 'cTn');
      const subDelay = num(attr(child(child(sc, 'stCondLst'), 'cond'), 'delay'));
      for (const ep of children(child(sc, 'childTnLst'), 'par')) {
        const ec = child(ep, 'cTn');
        if (!ec) continue;
        const cls = attr(ec, 'presetClass') ?? 'entr';
        const id = num(attr(ec, 'presetID'));
        const subtype = num(attr(ec, 'presetSubtype'));
        const nodeType = attr(ec, 'nodeType') ?? 'clickEffect';
        const effDelay = num(attr(child(child(ec, 'stCondLst'), 'cond'), 'delay'));
        const tgt = find(ec, 'spTgt');
        const spid = attr(tgt, 'spid');
        if (!spid) continue;
        if (child(tgt, 'txEl')) notes.push('Paragraph-level ("by paragraph") animations are applied to the whole text box.');
        const dur = behaviorDuration(ec);
        let effect: Effect | undefined;
        const anim: Partial<Animation> = {};
        if (cls === 'path') {
          effect = 'motionPath';
          const m = find(ec, 'animMotion');
          const d = motionD(attr(m, 'path') ?? 'M 0 0 L 0.1 0', size.width, size.height);
          anim.path = { type: 'custom', d };
        } else if (cls === 'entr' || cls === 'exit' || cls === 'emph') {
          effect = PRESET_MAP[`${cls}:${id}`];
          if (!effect) { effect = cls === 'entr' ? 'fadeIn' : cls === 'exit' ? 'fadeOut' : 'pulse'; notes.push(`PowerPoint animation preset ${cls} #${id} approximated as "${ANIMATION_EFFECTS[effect].label}".`); }
          if (cls === 'emph' && id === 6) {
            const sc2 = find(ec, 'animScale');
            const by = child(sc2, 'by');
            if (by) anim.scale = +(num(attr(by, 'x'), 100000) / 100000).toFixed(3);
            if (findAll(ec, 'cTn').some((c) => attr(c, 'autoRev') === '1')) effect = 'pulse';
          }
          if (effect === 'flyIn' || effect === 'flyOut') anim.direction = FLY_DIR[subtype] ?? (effect === 'flyIn' ? 'left' : 'right');
          if (effect === 'wipe' || effect === 'wipeOut') anim.direction = WIPE_DIR[subtype] ?? 'left';
          if (effect === 'split') anim.direction = subtype === 21 || subtype === 26 ? 'vertical' : 'horizontal';
          if (effect === 'colorChange') { const to = find(find(ec, 'animClr'), 'srgbClr'); if (to) anim.color = `#${attr(to, 'val')}`; }
          if (effect === 'transparency') { const s = findAll(ec, 'strVal').map((v) => Number(attr(v, 'val'))).find((v) => Number.isFinite(v) && v < 1); if (s !== undefined) anim.opacity = s; }
        } else continue;
        const rep = attr(ec, 'repeatCount');
        if (rep === 'indefinite') anim.repeat = 'infinite';
        else if (rep && num(rep) > 1000) anim.repeat = Math.round(num(rep) / 1000) - 1;
        const start = subDelay + effDelay;
        let trigger: Animation['trigger'];
        let delay = 0;
        if (k === 0) {
          trigger = auto ? (first ? 'onEnter' : 'afterPrevious') : 'onClick';
          delay = start;
        } else if (nodeType === 'afterEffect' && start >= prevEnd - 1) {
          trigger = 'afterPrevious'; delay = Math.max(0, start - prevEnd);
        } else {
          trigger = 'withPrevious'; delay = Math.max(0, start - prevStart);
        }
        out.push({ spid, anim: { effect, trigger, duration: dur, delay: Math.round(delay), ...anim } as Animation });
        prevStart = start; prevEnd = start + dur; k++;
      }
    }
    first = false;
  }
  return out;
}

/* ------------------------------ transitions ------------------------------ */
const SPD: Record<string, number> = { slow: 1000, med: 750, fast: 500 };
const D4: Record<string, string> = { l: 'left', r: 'right', u: 'up', d: 'down', lu: 'left', ru: 'right', ld: 'left', rd: 'right' };
const WIPE: Record<string, string> = { r: 'left', l: 'right', u: 'up', d: 'down' };

export function parseTransition(sld: XNode): { transition?: Transition; advance?: number; note?: string } {
  let tnode = child(sld, 'transition');
  for (const ac of kids(sld).filter((k) => k.tag === 'AlternateContent')) {
    const t = resolveAlternate(ac).find((k) => k.tag === 'transition');
    if (t) tnode = t;
  }
  if (!tnode) return {};
  const durAttr = attr(tnode, 'dur');
  const duration = durAttr ? num(durAttr) : SPD[attr(tnode, 'spd') ?? 'fast'] ?? 500;
  const advTm = attr(tnode, 'advTm');
  const advance = advTm ? num(advTm) : undefined;
  const advanceOnClick = attr(tnode, 'advClick') === '0' ? false : undefined;
  const inner = kids(tnode).find((k) => !['sndAc', 'extLst'].includes(k.tag));
  let type: Transition['type'] = 'none';
  let direction: string | undefined;
  let note: string | undefined;
  const dir = attr(inner, 'dir');
  switch (inner?.tag) {
    case undefined: type = 'none'; break;
    case 'fade': type = 'fade'; break;
    case 'dissolve': type = 'dissolve'; break;
    case 'push': type = 'push'; direction = D4[dir ?? 'l']; break;
    case 'wipe': type = 'wipe'; direction = WIPE[dir ?? 'r'] ?? 'left'; break;
    case 'split': type = 'split'; direction = attr(inner, 'orient') === 'vert' ? 'vertical' : 'horizontal'; break;
    case 'cover': type = 'cover'; direction = D4[dir ?? 'l']; break;
    case 'pull': type = 'uncover'; direction = D4[dir ?? 'l']; break;
    case 'zoom': case 'newsflash': case 'vortex': case 'ripple': case 'warp': type = 'zoom'; break;
    case 'randomBar': type = 'randomBars'; direction = dir === 'vert' ? 'vertical' : 'horizontal'; break;
    case 'blinds': type = 'blinds'; direction = dir === 'vert' ? 'vertical' : 'horizontal'; break;
    case 'checker': type = 'checkerboard'; direction = dir === 'vert' ? 'vertical' : 'horizontal'; break;
    case 'morph': type = 'morph'; break;
    case 'reveal': type = 'reveal'; direction = dir === 'r' ? 'right' : 'left'; break;
    case 'flip': type = 'flip'; direction = dir === 'r' ? 'right' : 'left'; break;
    case 'gallery': type = 'gallery'; direction = dir === 'r' ? 'right' : 'left'; break;
    case 'prism': case 'cube': case 'box': case 'rotate': case 'orbit': case 'conveyor': case 'pan': case 'switch': type = 'cube'; direction = D4[dir ?? 'l'] ?? 'left'; break;
    case 'cut': type = 'none'; break;
    case 'circle': case 'diamond': case 'plus': case 'wedge': case 'wheel': case 'wheelReverse': case 'shred': case 'ferris': case 'flythrough': case 'glitter': case 'honeycomb': case 'flash': case 'doors': case 'window': case 'vortex2': case 'curtains': case 'wind': case 'prestige': case 'fracture': case 'crush': case 'peelOff': case 'pageCurlDouble': case 'pageCurlSingle': case 'airplane': case 'origami': case 'strips': case 'comb': case 'random': case 'shape':
      type = 'fade'; note = `PowerPoint transition "${inner.tag}" approximated as Fade.`; break;
    default: type = 'fade'; note = `PowerPoint transition "${inner?.tag}" approximated as Fade.`;
  }
  if (type === 'none' && !advance && advanceOnClick === undefined) return {};
  const t: Transition = { type, duration: type === 'none' ? 0 : duration };
  if (direction) t.direction = direction;
  if (advance !== undefined) t.autoAdvance = advance;
  if (advanceOnClick === false) t.advanceOnClick = false;
  return { transition: t, advance, note };
}
