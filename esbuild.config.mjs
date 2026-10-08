import esbuild from "esbuild";
const prod = process.argv[2] === "production";
const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  // fs/path stay external: Obsidian runs in Electron with node integration, and the
  // plugin is isDesktopOnly. Do NOT switch to platform:node — Phaser needs the browser target.
  external: ["obsidian", "electron", "fs", "path"],
  format: "cjs",
  target: "es2020",
  sourcemap: prod ? false : "inline",
  minify: prod,
  outfile: "main.js",
});
if (prod) { await ctx.rebuild(); process.exit(0); }
else { await ctx.watch(); }
