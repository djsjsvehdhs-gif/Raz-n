import { build } from "esbuild";

await build({
  entryPoints: ["src/index.ts"],
  outfile: "dist/index.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: false,
  tsconfig: "tsconfig.json",
  loader: {
    ".js": "ts"
  }
});

console.log("✅ Build complete");
