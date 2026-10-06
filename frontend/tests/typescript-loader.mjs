import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".")) {
    const url = new URL(specifier, context.parentURL);
    for (const suffix of ["", ".ts", ".tsx", "/index.ts"]) {
      const candidate = new URL(url.href + suffix);
      try {
        if (!/\.tsx?$/.test(candidate.pathname)) continue;
        await access(fileURLToPath(candidate));
        return { url: candidate.href, shortCircuit: true };
      } catch {}
    }
  }
  return nextResolve(specifier, context);
}
export async function load(url, context, nextLoad) {
  if (/\.tsx?$/.test(new URL(url).pathname)) {
    const source = (await readFile(fileURLToPath(url), "utf8")).replace(
      /import\.meta\.env/g,
      '{ VITE_API_URL: "https://lexio.test" }',
    );
    return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(source, {
        fileName: fileURLToPath(url),
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  }
  return nextLoad(url, context);
}
