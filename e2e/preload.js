// Set contextIsolation to false to allow native modules
process.electronBinding = process.electronBinding || function(name) {
    try {
      return require(`electron`).app._linkedBinding(name);
    } catch (error) {
      console.warn(`Failed to get binding: ${name}`, error);
      return null;
    }
  };
  
  // Handle context-aware native addons issue
  if (process.type === 'renderer') {
    process._linkedBinding = process._linkedBinding || function(name) {
      try {
        return process.electronBinding(name);
      } catch (error) {
        console.warn(`Failed to link binding: ${name}`, error);
        return null;
      }
    };
  }
  
  if (process.env.ELECTRON_DISABLE_GPU === '1') {
    // Apply settings before app loads
    process.env.ELECTRON_DISABLE_GPU = '1';
    process.env.ELECTRON_NO_SANDBOX = '1';
    process.env.ELECTRON_DISABLE_SANDBOX = '1';
    process.env.ELECTRON_USE_SOFTWARE_RENDERER = '1';
  }
  
  // Suppress known xkbcomp warnings - they're not fatal but clutter logs
  process.env.XKB_LOG_LEVEL = 'error';
  process.env.XKB_DEFAULT_RULES = 'base';
  process.env.XKB_DEFAULT_MODEL = 'pc105';
  process.env.XKB_DEFAULT_LAYOUT = 'us';
  
  // Handle uncaught exceptions to prevent test runner from crashing without reporting
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    process.exit(1); // Exit gracefully to allow reporting
  });
  
  // Intercept GPU process errors
  const originalEmit = process.emit;
  process.emit = function(event, error) {
    if (event === 'uncaughtException' && 
        error && 
        error.message && 
        error.message.includes('GPU process')) {
      console.error('GPU process error intercepted:', error);
      return true;
    }
    return originalEmit.apply(this, arguments);
  };
