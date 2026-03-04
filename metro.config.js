const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'expo/virtual/env') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/expo/virtual/env.js'),
    };
  }

  if (typeof originalResolveRequest === 'function') {
    return originalResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
