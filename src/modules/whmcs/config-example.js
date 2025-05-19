// Example WHMCS module configuration
// Add this to your config.js file to enable WHMCS integration

module.exports = {
  // ... your existing configuration ...

  // WHMCS Integration
  whmcs: {
    enabled: process.env.WHMCS_ENABLED === 'true',
    apiUrl: process.env.WHMCS_API_URL || 'https://your-whmcs.example.com/includes/api.php',
    apiIdentifier: process.env.WHMCS_API_IDENTIFIER || 'your-api-identifier',
    apiSecret: process.env.WHMCS_API_SECRET || 'your-api-secret',
    panelUrl: process.env.WHMCS_PANEL_URL || 'https://panel.example.com',
    logFailures: true,
    
    // Set this to true during testing to get mock API responses
    mockApi: process.env.WHMCS_MOCK_API === 'true' || false,
    
    // Debug level can be 'debug', 'info', 'warn', 'error'
    logLevel: process.env.WHMCS_LOG_LEVEL || 'debug'
  }
};

// Then add these environment variables to your .env file:
/*
# WHMCS Integration
WHMCS_ENABLED=true
WHMCS_API_URL=https://your-whmcs.example.com/includes/api.php
WHMCS_API_IDENTIFIER=your-api-identifier
WHMCS_API_SECRET=your-api-secret
WHMCS_PANEL_URL=https://panel.example.com
WHMCS_MOCK_API=true
WHMCS_LOG_LEVEL=debug
*/