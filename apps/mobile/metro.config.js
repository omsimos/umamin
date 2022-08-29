const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const workspaceRoot = path.resolve(__dirname, '../..');
const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
