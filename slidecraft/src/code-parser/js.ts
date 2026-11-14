import type { Issue, LocMap } from './types';
import { ParseError } from './types';
import { parseProgram, StaticEvaluator } from './static-eval';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Find the presentation object in a JS/TS module: export default, module.exports, or a const with `slides`. */
export function parseJsModule(code: string): { data?: unknown; locs: LocMap; issues: Issue[] } {
  const locs: LocMap = new Map();
  const issues: Issue[] = [];
  try {
    const ast = parseProgram(code, false);
    const ev = new StaticEvaluator(locs);
    ev.registerProgram(ast.program);
    let target: any;
    for (const st of ast.program.body) {
      if (st.type === 'ExportDefaultDeclaration') target = st.declaration;
      else if (st.type === 'ExpressionStatement' && st.expression.type === 'AssignmentExpression' && st.expression.left.type === 'MemberExpression' && st.expression.left.object.name === 'module') target = st.expression.right;
      else if (!target && st.type === 'ExpressionStatement' && (st.expression.type === 'ObjectExpression' || st.expression.type === 'ParenthesizedExpression')) target = st.expression;
    }
    if (!target) {
      for (const st of ast.program.body) {
        const decl = st.type === 'ExportNamedDeclaration' ? st.declaration : st;
        if (decl?.type === 'VariableDeclaration') for (const d of decl.declarations) {
          const init = d.init?.type === 'TSAsExpression' || d.init?.type === 'TSSatisfiesExpression' ? d.init.expression : d.init;
          if (init?.type === 'ObjectExpression' && init.properties.some((p: any) => p.key?.name === 'slides' || p.key?.value === 'slides')) target = d.init;
        }
      }
    }
    if (!target) {
      issues.push({ severity: 'error', code: 'js.noExport', message: 'No presentation object found. Use `export default { schemaVersion: "1.0", ... }`.' });
      return { locs, issues };
    }
    if (target.type === 'Identifier') target = ev.getGlobal(target.name) ?? target;
    const data = ev.eval(target, new Map(), []);
    ev.warnings.forEach((w) => issues.push({ severity: 'warning', code: 'js.identifier', message: w.message, ...w.loc }));
    return { data, locs, issues };
  } catch (e) {
    const err = e as ParseError;
    issues.push({ severity: 'error', code: 'syntax', message: err.message, ...(err.loc ?? {}) });
    return { locs, issues };
  }
}
