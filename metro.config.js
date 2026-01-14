// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Intercepter les erreurs de lecture de fichiers inexistants (InternalBytecode.js)
if (config.server) {
  const originalEnhanceMiddleware = config.server.enhanceMiddleware;
  config.server.enhanceMiddleware = (middleware) => {
    const enhanced = originalEnhanceMiddleware 
      ? originalEnhanceMiddleware(middleware)
      : middleware;
    
    return (req, res, next) => {
      // Ignorer silencieusement les requêtes pour InternalBytecode.js
      if (req.url && req.url.includes('InternalBytecode.js')) {
        res.statusCode = 404;
        res.end();
        return;
      }
      return enhanced(req, res, next);
    };
  };
} else {
  config.server = {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        // Ignorer silencieusement les requêtes pour InternalBytecode.js
        if (req.url && req.url.includes('InternalBytecode.js')) {
          res.statusCode = 404;
          res.end();
          return;
        }
        return middleware(req, res, next);
      };
    },
  };
}

module.exports = config;

