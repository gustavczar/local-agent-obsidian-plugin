import esbuild from "esbuild";
const prod = process.argv[2] === "production";
const ctx = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron"],
  format: "cjs",
  target: "es2020",
  sourcemap: prod ? false : "inline",
  minify: prod,
  outfile: "main.js",
});
if (prod) { await ctx.rebuild(); process.exit(0); }
else { await ctx.watch(); }
