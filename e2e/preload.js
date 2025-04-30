// This file helps configure electron-mocha for headless environments

if (process.env.ELECTRON_DISABLE_GPU === '1') {
    // Apply settings before app loads
    process.env.ELECTRON_DISABLE_GPU = '1';
    process.env.ELECTRON_NO_SANDBOX = '1';
    process.env.ELECTRON_DISABLE_SANDBOX = '1';
  }
  
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