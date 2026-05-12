import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  packages: "external",
  sourcemap: false,
  tsconfig: "tsconfig.json",
});

console.log("✅ Build complete");
