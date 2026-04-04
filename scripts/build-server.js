const esbuild = require("esbuild");
const { version } = require("../package.json");

esbuild.buildSync({
  entryPoints: ["src/bin/claude-canvas.ts", "src/server/index.ts"],
  bundle: true,
  platform: "node",
  outdir: "dist",
  format: "cjs",
  external: ["esbuild"],
  define: {
    PACKAGE_VERSION: JSON.stringify(version),
  },
});
