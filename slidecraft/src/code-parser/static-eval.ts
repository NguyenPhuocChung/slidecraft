/**
 * Safe static evaluator for JavaScript / TSX presentation sources.
 * Nothing is executed: we walk the Babel AST and only fold literal values,
 * constants, template strings, spreads, simple arithmetic and `.map()` with
 * arrow functions. Any other construct is reported as unsupported.
 */
import { parse } from '@babel/parser';
import type { LocMap, SourceLoc } from './types';
import { ParseError, pathKey } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type N = any;

export interface JsxNode {
  __jsx: true;
  name: string;
  props: Record<string, unknown>;
  children: unknown[];
  loc?: SourceLoc;
}
export const isJsx = (v: unknown): v is JsxNode => !!v && typeof v === 'object' && (v as JsxNode).__jsx === true;

const MAX_STEPS = 200_000;

export class StaticEvaluator {
  steps = 0;
  warnings: { message: string; loc?: SourceLoc }[] = [];
  private globals = new Map<string, N>();
  private cache = new Map<string, unknown>();
  private resolving = new Set<string>();
  constructor(public locs: LocMap = new Map()) {}

  registerProgram(program: N) {
    for (const st of program.body) this.registerStatement(st);
  }
  registerStatement(st: N, scope?: Map<string, unknown>) {
    const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
    if (!decl) return;
    if (decl.type === 'VariableDeclaration') {
      for (const d of decl.declarations) if (d.id.type === 'Identifier' && d.init) {
        if (scope) scope.set(d.id.name, this.eval(d.init, scope));
        else this.globals.set(d.id.name, d.init);
      }
    } else if (decl.type === 'FunctionDeclaration' && decl.id && !scope) {
      this.globals.set(decl.id.name, decl);
    }
  }
  getGlobal(name: string): N | undefined {
    return this.globals.get(name);
  }

  private tick(node: N) {
    if (++this.steps > MAX_STEPS) throw new ParseError('Source is too complex to evaluate statically (step limit reached).', loc(node));
  }

  eval(node: N, scope: Map<string, unknown> = new Map(), path?: (string | number)[]): unknown {
    this.tick(node);
    if (path && node?.loc) this.locs.set(pathKey(path), loc(node)!);
    switch (node.type) {
      case 'StringLiteral': case 'NumericLiteral': case 'BooleanLiteral':
        return node.value;
      case 'NullLiteral':
        return null;
      case 'BigIntLiteral':
        return Number(node.value);
      case 'TemplateLiteral': {
        let s = '';
        node.quasis.forEach((q: N, i: number) => {
          s += q.value.cooked ?? q.value.raw;
          if (node.expressions[i]) s += String(this.eval(node.expressions[i], scope));
        });
        return s;
      }
      case 'TSAsExpression': case 'TSSatisfiesExpression': case 'TSNonNullExpression': case 'ParenthesizedExpression': case 'TypeCastExpression':
        return this.eval(node.expression, scope, path);
      case 'ArrayExpression': {
        const out: unknown[] = [];
        node.elements.forEach((el: N) => {
          if (!el) return out.push(null);
          if (el.type === 'SpreadElement') { const v = this.eval(el.argument, scope); if (Array.isArray(v)) out.push(...v); return; }
          out.push(this.eval(el, scope, path ? [...path, out.length] : undefined));
        });
        return out;
      }
      case 'ObjectExpression': {
        const o: Record<string, unknown> = {};
        for (const p of node.properties) {
          if (p.type === 'SpreadElement') { const v = this.eval(p.argument, scope); if (v && typeof v === 'object') Object.assign(o, v); continue; }
          if (p.type === 'ObjectMethod') throw new ParseError('Object methods are not allowed in presentation data.', loc(p));
          const key = p.computed ? String(this.eval(p.key, scope)) : p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
          if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
          o[key] = p.shorthand && p.value.type === 'Identifier' ? this.ident(p.value, scope) : this.eval(p.value, scope, path ? [...path, key] : undefined);
        }
        return o;
      }
      case 'Identifier':
        return this.ident(node, scope);
      case 'UnaryExpression': {
        const v = this.eval(node.argument, scope) as never;
        switch (node.operator) {
          case '-': return -v;
          case '+': return +v;
          case '!': return !v;
          case 'typeof': return typeof v;
          default: throw new ParseError(`Unsupported operator "${node.operator}".`, loc(node));
        }
      }
      case 'BinaryExpression': {
        const a = this.eval(node.left, scope) as never, b = this.eval(node.right, scope) as never;
        switch (node.operator) {
          case '+': return (a as number) + (b as number);
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
          case '%': return a % b;
          case '**': return (a as number) ** (b as number);
          case '===': case '==': return a === b;
          case '!==': case '!=': return a !== b;
          case '<': return a < b;
          case '>': return a > b;
          case '<=': return a <= b;
          case '>=': return a >= b;
          default: throw new ParseError(`Unsupported operator "${node.operator}".`, loc(node));
        }
      }
      case 'LogicalExpression': {
        const a = this.eval(node.left, scope);
        if (node.operator === '&&') return a ? this.eval(node.right, scope) : a;
        if (node.operator === '||') return a || this.eval(node.right, scope);
        return a ?? this.eval(node.right, scope);
      }
      case 'ConditionalExpression':
        return this.eval(node.test, scope) ? this.eval(node.consequent, scope, path) : this.eval(node.alternate, scope, path);
      case 'MemberExpression': case 'OptionalMemberExpression': {
        const obj = this.eval(node.object, scope) as Record<string, unknown> | undefined;
        const key = node.computed ? String(this.eval(node.property, scope)) : node.property.name;
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new ParseError('Prototype access is not allowed.', loc(node));
        if (obj === null || obj === undefined) return undefined;
        if (Array.isArray(obj) && key === 'length') return obj.length;
        if (typeof obj === 'string' && key === 'length') return (obj as string).length;
        return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
      }
      case 'CallExpression': case 'OptionalCallExpression':
        return this.call(node, scope);
      case 'ArrowFunctionExpression': case 'FunctionExpression':
        return { __fn: node, scope };
      case 'JSXElement': case 'JSXFragment':
        return this.jsx(node, scope);
      default:
        throw new ParseError(`Unsupported syntax "${node.type}" — only static data, constants, templates and .map() are allowed.`, loc(node));
    }
  }

  private ident(node: N, scope: Map<string, unknown>): unknown {
    const name = node.name;
    if (scope.has(name)) return scope.get(name);
    if (name === 'undefined') return undefined;
    if (name === 'Infinity') return Infinity;
    if (this.cache.has(name)) return this.cache.get(name);
    const g = this.globals.get(name);
    if (g && g.type !== 'FunctionDeclaration') {
      if (this.resolving.has(name)) throw new ParseError(`Circular reference to "${name}".`, loc(node));
      this.resolving.add(name);
      const v = this.eval(g);
      this.resolving.delete(name);
      this.cache.set(name, v);
      return v;
    }
    if (g) return { __fn: g, scope: new Map() };
    this.warnings.push({ message: `Unknown identifier "${name}" treated as undefined.`, loc: loc(node) });
    return undefined;
  }

  private call(node: N, scope: Map<string, unknown>): unknown {
    const callee = node.callee;
    if (callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') {
      const method = callee.computed ? null : callee.property.name;
      const target = this.eval(callee.object, scope);
      const args = node.arguments;
      if (Array.isArray(target)) {
        if (method === 'map' || method === 'filter' || method === 'flatMap') {
          const fn = this.eval(args[0], scope) as { __fn: N; scope: Map<string, unknown> };
          if (!fn?.__fn) throw new ParseError('Only inline arrow functions are supported in .map().', loc(node));
          const res = target.map((item, i) => this.apply(fn, [item, i]));
          if (method === 'filter') return target.filter((_, i) => res[i]);
          if (method === 'flatMap') return res.flat();
          return res;
        }
        if (method === 'slice') return target.slice(...args.map((a: N) => this.eval(a, scope) as number));
        if (method === 'concat') return target.concat(...args.map((a: N) => this.eval(a, scope)));
        if (method === 'join') return target.join(args[0] ? String(this.eval(args[0], scope)) : ',');
        if (method === 'reverse') return [...target].reverse();
      }
      if (typeof target === 'string') {
        const a = args.map((x: N) => this.eval(x, scope));
        if (method === 'toUpperCase') return target.toUpperCase();
        if (method === 'toLowerCase') return target.toLowerCase();
        if (method === 'trim') return target.trim();
        if (method === 'split') return target.split(String(a[0]));
        if (method === 'padStart') return target.padStart(Number(a[0]), a[1] ? String(a[1]) : ' ');
        if (method === 'repeat') return target.repeat(Math.min(1000, Number(a[0])));
      }
      if (typeof target === 'number' && method === 'toFixed') return target.toFixed(Number(this.eval(args[0], scope) ?? 0));
      if (callee.object.type === 'Identifier' && callee.object.name === 'Math' && method && ['round', 'floor', 'ceil', 'min', 'max', 'abs'].includes(method)) {
        return (Math as unknown as Record<string, (...n: number[]) => number>)[method](...args.map((a: N) => Number(this.eval(a, scope))));
      }
      if (callee.object.type === 'Identifier' && callee.object.name === 'Array' && method === 'from') {
        const src = this.eval(args[0], scope) as { length?: number } | unknown[];
        const arr = Array.isArray(src) ? src : Array.from({ length: Math.min(1000, Number((src as { length?: number })?.length ?? 0)) });
        if (args[1]) { const fn = this.eval(args[1], scope) as { __fn: N; scope: Map<string, unknown> }; return arr.map((v, i) => this.apply(fn, [v, i])); }
        return arr;
      }
      if (callee.object.type === 'Identifier' && callee.object.name === 'Object' && method && ['keys', 'values', 'entries'].includes(method)) {
        const o = this.eval(args[0], scope) as Record<string, unknown>;
        return method === 'keys' ? Object.keys(o ?? {}) : method === 'values' ? Object.values(o ?? {}) : Object.entries(o ?? {});
      }
    }
    if (callee.type === 'Identifier' && ['String', 'Number'].includes(callee.name)) {
      const v = this.eval(node.arguments[0], scope);
      return callee.name === 'String' ? String(v) : Number(v);
    }
    if (callee.type === 'Identifier') {
      const fn = this.ident(callee, scope) as { __fn?: N; scope?: Map<string, unknown> };
      if (fn?.__fn) return this.apply(fn as { __fn: N; scope: Map<string, unknown> }, node.arguments.map((a: N) => this.eval(a, scope)));
    }
    throw new ParseError('Function calls are not allowed (only .map/.filter/.slice and a few pure helpers).', loc(node));
  }

  /** Apply a user arrow/function — body must be an expression or a block with consts + a single return. */
  apply(fn: { __fn: N; scope: Map<string, unknown> }, args: unknown[]): unknown {
    const f = fn.__fn;
    const scope = new Map(fn.scope);
    f.params.forEach((p: N, i: number) => this.bind(p, args[i], scope));
    if (f.body.type !== 'BlockStatement') return this.eval(f.body, scope);
    for (const st of f.body.body) {
      if (st.type === 'VariableDeclaration') {
        for (const d of st.declarations) this.bind(d.id, d.init ? this.eval(d.init, scope) : undefined, scope);
      } else if (st.type === 'ReturnStatement') {
        return st.argument ? this.eval(st.argument, scope) : undefined;
      } else if (st.type !== 'EmptyStatement') {
        throw new ParseError(`Unsupported statement "${st.type}" inside function.`, loc(st));
      }
    }
    return undefined;
  }

  private bind(pattern: N, value: unknown, scope: Map<string, unknown>) {
    if (!pattern) return;
    if (pattern.type === 'Identifier') scope.set(pattern.name, value);
    else if (pattern.type === 'AssignmentPattern') this.bind(pattern.left, value === undefined ? this.eval(pattern.right, scope) : value, scope);
    else if (pattern.type === 'ObjectPattern') {
      const v = (value ?? {}) as Record<string, unknown>;
      for (const p of pattern.properties) {
        if (p.type === 'RestElement') continue;
        const key = p.key.type === 'Identifier' ? p.key.name : String(p.key.value);
        this.bind(p.value, v[key], scope);
      }
    } else if (pattern.type === 'ArrayPattern') {
      const v = (value ?? []) as unknown[];
      pattern.elements.forEach((el: N, i: number) => this.bind(el, v[i], scope));
    }
  }

  private jsx(node: N, scope: Map<string, unknown>): unknown {
    if (node.type === 'JSXFragment') return this.jsxChildren(node.children, scope);
    const nameNode = node.openingElement.name;
    const name = nameNode.type === 'JSXIdentifier' ? nameNode.name : nameNode.type === 'JSXMemberExpression' ? `${nameNode.object.name}.${nameNode.property.name}` : String(nameNode.name?.name ?? 'unknown');
    const props: Record<string, unknown> = {};
    for (const a of node.openingElement.attributes) {
      if (a.type === 'JSXSpreadAttribute') { const v = this.eval(a.argument, scope); if (v && typeof v === 'object') Object.assign(props, v); continue; }
      const key = a.name.type === 'JSXNamespacedName' ? `${a.name.namespace.name}:${a.name.name.name}` : a.name.name;
      if (a.value === null) props[key] = true;
      else if (a.value.type === 'StringLiteral') props[key] = a.value.value;
      else if (a.value.type === 'JSXExpressionContainer') props[key] = a.value.expression.type === 'JSXEmptyExpression' ? undefined : this.eval(a.value.expression, scope);
      else props[key] = this.eval(a.value, scope);
    }
    // Local component defined in the same file: inline it.
    const g = /^[A-Z]/.test(name) ? this.globals.get(name) : undefined;
    const children = this.jsxChildren(node.children, scope);
    if (g && (g.type === 'FunctionDeclaration' || g.type === 'ArrowFunctionExpression' || (g.type === 'VariableDeclarator'))) {
      return this.apply({ __fn: g, scope: new Map() }, [{ ...props, children }]);
    }
    const local = /^[A-Z]/.test(name) && this.globals.has(name) ? this.globals.get(name) : undefined;
    if (local && (local.type === 'ArrowFunctionExpression' || local.type === 'FunctionExpression')) {
      return this.apply({ __fn: local, scope: new Map() }, [{ ...props, children }]);
    }
    return { __jsx: true, name, props, children, loc: loc(node) } satisfies JsxNode;
  }

  private jsxChildren(children: N[], scope: Map<string, unknown>): unknown[] {
    const out: unknown[] = [];
    for (const c of children) {
      if (c.type === 'JSXText') {
        const t = c.value.replace(/\s*\n\s*/g, ' ');
        if (t.trim()) out.push(t.trim() === t ? t : t.replace(/^\s+|\s+$/g, (m: string) => (m.includes('\n') ? '' : ' ')).trim());
      } else if (c.type === 'JSXExpressionContainer') {
        if (c.expression.type === 'JSXEmptyExpression') continue;
        const v = this.eval(c.expression, scope);
        if (Array.isArray(v)) out.push(...v.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
        else if (v !== null && v !== undefined && v !== false) out.push(v);
      } else if (c.type === 'JSXElement' || c.type === 'JSXFragment') {
        const v = this.jsx(c, scope);
        if (Array.isArray(v)) out.push(...v);
        else out.push(v);
      }
    }
    return out;
  }
}

export function loc(node: N): SourceLoc | undefined {
  return node?.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : undefined;
}

export function parseProgram(code: string, jsx: boolean): N {
  try {
    return parse(code, { sourceType: 'module', plugins: jsx ? ['jsx', 'typescript'] : ['typescript'], errorRecovery: false });
  } catch (e) {
    const err = e as { message: string; loc?: { line: number; column: number } };
    throw new ParseError(err.message.replace(/\s*\(\d+:\d+\)$/, ''), err.loc ? { line: err.loc.line, column: err.loc.column + 1 } : undefined);
  }
}
