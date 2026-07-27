// A `.wasm` import resolves to a precompiled WebAssembly.Module under both the
// vitest workers pool (modulesRules: CompiledWasm) and the Cloudflare Vite/
// wrangler build (default `**/*.wasm` → CompiledWasm) — never runtime bytes,
// which workerd forbids compiling.
declare module "*.wasm" {
  const module: WebAssembly.Module;
  export default module;
}
