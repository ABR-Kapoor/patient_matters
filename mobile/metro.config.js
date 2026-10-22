// Metro watches the whole project root. Three things in there are pure noise,
// and each one costs a full bundle rebuild:
//
//   .kilo/worktrees/<name>/  This checkout has git worktrees nested INSIDE the
//                            project root, and each is a complete second copy of
//                            src/, assets/ and package.json. An edit anywhere in
//                            one of them changed the file map and reloaded the
//                            app even though nothing it imports had changed.
//   .git/                    Objects and FETCH_HEAD churn constantly.
//   .expo/                   Dev-server state. start.log alone reached 17.8 MB
//                            over ~100 restarts because it is never truncated.
//
// The block list is appended to Expo\'s defaults rather than replacing them, so
// .expo/types (typed routes) and android/app/build stay excluded as before.
//
// maxWorkers is capped because the default of 10 per server is per-process: with
// both apps plus two Next.js dev servers running, 20 Metro workers pushed the
// machine to 1.6 GB free of 15.7 GB and bundles stalled mid-transform with no
// bundling:done ever emitted. Fewer workers trades a little bundle time for a
// dev server that actually finishes.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

// Metro matches these against the project-root-relative path, so a pattern that
// requires a leading separator would miss .git at the root. Match either.
const neverWatched = [
  /(^|[/\\])\.kilo([/\\]|$)/,
  /(^|[/\\])\.git([/\\]|$)/,
  /(^|[/\\])\.expo([/\\]|$)/,
];

config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  ...neverWatched,
];

config.maxWorkers = 4;

module.exports = config;
