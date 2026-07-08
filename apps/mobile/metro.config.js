// Monorepo-aware Metro config (pnpm workspace).
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// Watchman can't read ~/Documents under macOS privacy protection (TCC);
// Metro's node watcher handles a repo this size fine.
config.resolver.useWatchman = false;

module.exports = config;
