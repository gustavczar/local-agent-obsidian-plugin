// The plugin uses window.setTimeout/clearTimeout (Obsidian popout-window
// compatibility). The node test environment has no `window`, so alias it to
// globalThis for the timer functions used under test.
if (typeof (globalThis as { window?: unknown }).window === "undefined") {
  (globalThis as { window?: unknown }).window = globalThis;
}
