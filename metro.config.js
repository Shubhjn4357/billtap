const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.transformer.getTransformOptions = async () => ({
    transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
    },
});

config.resolver.sourceExts.push('sql'); // Add SQL support
config.resolver.assetExts.push('wasm'); // Add WASM support

module.exports = config;

