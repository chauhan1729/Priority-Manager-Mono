const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo so Metro sees workspace packages
config.watchFolders = [workspaceRoot];

// 2. Resolve packages from the mobile app first, then the workspace root.
//    This ensures only one copy of each package is used (avoids native/JS
//    version mismatches for packages like react-native-reanimated).
//    Also include pnpm's virtual store (.pnpm/node_modules) so transitive
//    deps like @expo/log-box that live there can be resolved by Metro.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules/.pnpm/node_modules'),
];

// 3. Prevent Metro from walking up the directory tree beyond nodeModulesPaths.
//    Critical in pnpm monorepos where hoisted packages at unexpected depths
//    can shadow the app-level copies.
config.resolver.disableHierarchicalLookup = true;

// 4. Force semver to v7 — the hoisted .pnpm/node_modules copy is v6 (no
//    functions/ subdirectory), but react-native-reanimated needs
//    semver/functions/satisfies which only exists in semver v7+.
//    Also alias react-native-web to the mobile app's own copy so Metro
//    finds it even when pnpm hoists it to a deeply-nested virtual store path.
config.resolver.extraNodeModules = {
  semver: path.resolve(
    workspaceRoot,
    'node_modules/.pnpm/semver@7.7.4/node_modules/semver'
  ),
  'react-native-web': path.resolve(projectRoot, 'node_modules/react-native-web'),
};

module.exports = config;
