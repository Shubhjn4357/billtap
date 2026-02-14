module.exports = {
  hooks: {
    readPackage(pkg) {
      // Auto-approve esbuild scripts for Vercel builds
      if (pkg.name === 'esbuild') {
        pkg.scripts = pkg.scripts || {};
        pkg.scripts.preinstall = '';
        pkg.scripts.postinstall = '';
      }
      return pkg;
    }
  }
};
