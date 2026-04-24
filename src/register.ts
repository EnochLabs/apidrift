/**
 * apidrift/register — auto-patches global fetch
 * import "apidrift/register"  ← that's it
 */
import { patchFetch } from "./interceptors/fetch.js";

const silent = process.env.APIDRIFT_SILENT === "1";
const filterStr = process.env.APIDRIFT_FILTER;
const filter = filterStr ? (url: string) => url.includes(filterStr) : undefined;

patchFetch({
  silent,
  filter,
  onBreaking: (result) => {
    if (process.env.APIDRIFT_CI === "1") {
      console.error(`\n[apidrift] FATAL: Breaking drift in ${result.endpoint} — exiting (APIDRIFT_CI=1)\n`);
      process.exit(1);
    }
  },
});

if (!silent) {
  console.log(`\x1b[90m[apidrift] Watching API responses for drift...\x1b[0m`);
}
