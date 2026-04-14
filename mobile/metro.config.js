const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Allow importing shared content from sibling `web/` (e.g. web/src/shared/neoContent.ts)
config.watchFolders = [path.resolve(projectRoot, "..")];

module.exports = config;
