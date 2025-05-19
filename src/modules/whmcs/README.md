# WHMCS Integration Module

This module integrates the Discord bot with WHMCS, allowing user service information to be displayed in ticket channels and via commands.

> **Important Note**: This bot's WHMCS module requires the WHMCS Link Discord module created by Andrezzz. Without this WHMCS module installed, the bot's WHMCS integration functionality will not work properly.

## Features

- Fetches client information from WHMCS using Discord ID
- Displays client services in ticket channels automatically
- Classifies services as active or inactive with appropriate colors
- Generates control panel links from service UUIDs
- Plugin-based architecture that works even if not installed
- Staff can check services for any user

## Commands

- `/services` - Shows services based on context:
  - In ticket channels: Shows the ticket creator's services
  - Outside ticket channels: Shows your own services
  - With user parameter: Shows the specified user's services (staff only)

## Configuration

Add the following section to your `config.js` file:

```javascript
// WHMCS Integration
whmcs: {
  enabled: process.env.WHMCS_ENABLED === 'true',
  apiUrl: process.env.WHMCS_API_URL,
  apiIdentifier: process.env.WHMCS_API_IDENTIFIER,
  apiSecret: process.env.WHMCS_API_SECRET,
  panelUrl: process.env.WHMCS_PANEL_URL,
  logFailures: process.env.WHMCS_LOG_FAILURES === 'true',
  mockApi: process.env.WHMCS_MOCK_API === 'true' || false,
  
  // Synchronization settings
  syncInterval: parseInt(process.env.WHMCS_SYNC_INTERVAL || '30', 10), // in minutes
  
  // Ticket mapping
  departmentMap: {
    general: 1, // WHMCS department ID for general
    billing: 2, // WHMCS department ID for billing
    tech: 3     // WHMCS department ID for technical support
  }
}
```

Then add the corresponding environment variables to your `.env` file:

```
# WHMCS Integration
WHMCS_ENABLED=true
WHMCS_API_URL=https://your-whmcs-instance.com/includes/api.php
WHMCS_API_IDENTIFIER=your-api-identifier
WHMCS_API_SECRET=your-api-secret
WHMCS_PANEL_URL=https://your-panel-url.com
WHMCS_LOG_FAILURES=true
WHMCS_MOCK_API=false
WHMCS_SYNC_INTERVAL=30
```

## API Requirements

This module requires the following WHMCS API endpoints:

1. `GetClientID` - Custom API endpoint that takes a Discord ID and returns a client ID
   - Input: `discordid` - The Discord user ID
   - Output: `{"result":"success", "clientid":"123"}`

2. `GetClientsProducts` - Standard WHMCS API to get client services
   - Input: `clientid` - The WHMCS client ID
   - Output: List of services with details

## Service Display

Services are displayed in ticket channels with the following information:

- Service name and status
- Service category (group name)
- Billing cycle
- Next due date
- Connection location (domain)
- Control panel link (generated from UUID)

Services are organized into two embeds:
- Active services (status="Active") - Green embed
- Inactive services (all other statuses) - Gray embed

## UUID Processing

The module extracts UUID values from customfields and formats them according to the specified requirements:

1. Finds a customfield with "uuid" or "server id" in its name
2. Extracts the first section of the UUID (before the first dash)
3. Generates a panel URL in the format: `{PANEL_URL}/server/{uuid.split('-')[0]}`

## Testing & Debugging

### Mock API

For testing without a real WHMCS installation, set `WHMCS_MOCK_API=true` in your `.env` file. This will return mock data instead of making actual API calls.

### Logging

The module has its own dedicated logging system:
- All WHMCS-related logs are written to `logs/whmcs/whmcs.log`
- You can control the log level with `WHMCS_LOG_LEVEL` (debug, info, warn, error)
- Sensitive information is never logged

### Troubleshooting

If services are not displaying:
1. Check `logs/whmcs/whmcs.log` for detailed error messages
2. Verify API credentials are correct in your `.env` file
3. Ensure the Discord user has a valid WHMCS account linked through the `GetClientID` API

## Installation

The module is designed as a plug-and-play addition with no core code modifications required.

1. Copy the module files to the `src/modules/whmcs` directory
2. Add the WHMCS configuration to your `config.js` file
3. Set up the required environment variables
4. Run `npm run deploy` to update commands
5. Restart the bot

When enabled, the module will automatically hook into the ticket creation process and display service information in new tickets.

## Security

- API credentials are stored securely in environment variables
- Permissions are enforced for querying other users' services
- No sensitive information is displayed in service cards

## Customization

You can customize the look and content of the service cards by modifying:
- `createServiceEmbeds()` method in `service.js` to change the embed structure
- `formatServiceDetails()` method in `service.js` to change what details are displayed

## Dependencies

This module depends on:
- `axios` for making API requests
- `discord.js` for creating embeds
- `winston` for logging