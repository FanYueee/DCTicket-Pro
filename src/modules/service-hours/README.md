# Service Hours Module

This module provides service hours and holiday management functionality for the DCTicket bot, enabling automatic notifications during off-hours and managing special holiday periods.

## Features

- Multiple service hour schedules with cron expression support
- Holiday management system (one-time and recurring holidays)
- Automatic off-hours notifications for new tickets
- Integration with AI module for 24/7 AI support availability
- Timezone-aware scheduling
- Real-time service status checking
- Customizable off-hours messages
- Holiday-specific embed notifications

## Components

### Core Files

- `index.js` - Main module entry point with command registration
- `service.js` - Service layer for business logic and scheduling
- `repository.js` - Data access layer for service hours and holidays

### Commands

- `/hours` - Manage service hours with subcommands:
  - `view` - View current service hour settings
  - `add` - Add new service hours schedule
    - `cron` - Cron expression (e.g., `* 9-17 * * 1-5`)
    - `description` - Schedule description
  - `del` - Delete service hour schedules
    - `ids` - Comma-separated IDs to delete
  - `toggle` - Enable/disable service hours globally
    - `enable` - Enable or disable all schedules

- `/holiday` - Manage holidays with subcommands:
  - `add` - Add new holiday (opens modal dialog)
    - Name: Holiday name (e.g., "Spring Festival")
    - Reason: Detailed reason for the holiday
    - Type: `O` for one-time, `R` for recurring
    - Schedule: Date range or cron expression
  - `list` - View all holidays
  - `delete` - Delete a holiday
    - `id` - Holiday ID to delete
  - `toggle` - Enable/disable a holiday
    - `id` - Holiday ID
    - `enabled` - Enable or disable

## Configuration

Add the following section to your `config.js` file:

```javascript
// Service Hours Configuration
serviceHours: {
  enabled: true,
  workdays: [1, 2, 3, 4, 5], // Monday to Friday (0 is Sunday, 6 is Saturday)
  workHoursStart: 9, // 9 AM
  workHoursEnd: 18, // 6 PM

  // Message to show when outside working hours
  offHoursMessage: 'Thank you for contacting us. We are currently outside of our service hours. Please leave your message and we will respond on the next business day.',

  // Message to show when creating a ticket outside working hours
  newTicketOffHoursMessage: 'We are currently outside of our service hours. You can utilize our AI assistant to help with your issue. If unresolved, please request human support and we will assist you on the next business day.'
}
```

## Cron Expression Format

Cron expressions follow the format: `minute hour day month weekday`

### Common Examples

- `* 9-17 * * 1-5` - Monday to Friday, 9:00 AM to 5:59 PM
- `0 9-17 * * 1-5` - Monday to Friday, hourly from 9:00 AM to 5:00 PM
- `* 9-12,14-17 * * 1-5` - Monday to Friday, 9-12 and 2-5 PM (lunch break)
- `* 8-9 * * *` - Every day, 8:00 AM to 9:59 AM
- `* 11 * * *` - Every day, 11:00 AM to 11:59 AM
- `* * * * 6,0` - Weekends all day

### Special Characters

- `*` - Any value
- `,` - Value list separator (e.g., `1,3,5`)
- `-` - Range of values (e.g., `9-17`)
- `/` - Step values (e.g., `*/15` for every 15 minutes)

### Weekday Values

- 0 - Sunday
- 1 - Monday
- 2 - Tuesday
- 3 - Wednesday
- 4 - Thursday
- 5 - Friday
- 6 - Saturday

## Holiday System

### One-time Holidays

For specific date ranges (e.g., national holidays):
- Format: `YYYY-MM-DD HH:mm ~ YYYY-MM-DD HH:mm`
- Example: `2025-02-08 00:00 ~ 2025-02-14 23:59`

### Recurring Holidays

For regular maintenance or recurring events:
- Uses cron expression format
- Example: `0 2-4 * * 3` (Every Wednesday 2-4 AM)

### Holiday Notifications

When a ticket is created during a holiday:
- Displays a special embed with holiday information
- Shows the holiday name and reason
- Calculates and displays the next service time
- Allows users to leave messages for later response

## Database Schema

### service_hours Table
- `id` - Primary key
- `guild_id` - Discord guild ID
- `cron_expression` - Cron expression for the schedule
- `description` - Human-readable description
- `enabled` - Active status

### holidays Table
- `id` - Primary key
- `guild_id` - Discord guild ID
- `name` - Holiday name
- `reason` - Holiday reason/description
- `cron_expression` - For recurring holidays
- `start_date` - For one-time holidays
- `end_date` - For one-time holidays
- `is_recurring` - Holiday type flag
- `enabled` - Active status
- `created_by` - User ID who created the holiday

## Integration with Other Modules

### Ticket Module Integration
- Automatically checks service hours when tickets are created
- Sends appropriate off-hours or holiday messages
- Tracks off-hours notifications to prevent spam

### AI Module Integration
- AI continues to function during off-hours
- Service hour status is passed to AI for context
- Off-hours messages encourage AI usage before human escalation

## Usage Examples

### Setting Up Service Hours
```
/hours add cron:* 9-17 * * 1-5 description:Monday-Friday 9AM-6PM
/hours add cron:* 9-12 * * 6 description:Saturday 9AM-12PM
```

### Creating a Holiday
1. Run `/holiday add`
2. Fill in the modal:
   - Name: Spring Festival
   - Reason: Company holiday for Spring Festival celebration
   - Type: O
   - Schedule: 2025-02-08 00:00 ~ 2025-02-14 23:59

### Setting Recurring Maintenance
1. Run `/holiday add`
2. Fill in the modal:
   - Name: Weekly Maintenance
   - Reason: System maintenance window
   - Type: R
   - Schedule: 0 2-4 * * 3

## Best Practices

1. **Priority**: Holidays take precedence over regular service hours
2. **Timezone**: All times use the configured timezone (default: Asia/Taipei)
3. **Permissions**: Only administrators can manage service hours and holidays
4. **Testing**: Use `/hours view` to verify current status before going live
5. **Monitoring**: Check logs for service hour calculation details

## Troubleshooting

### Issue: Incorrect Next Service Time
- Verify timezone setting in config.js
- Check for overlapping or conflicting schedules
- Ensure only enabled schedules are active
- Review debug logs for calculation details

### Issue: Holiday Not Triggering
- Confirm holiday is enabled using `/holiday list`
- Verify date/time format or cron expression
- Check that holiday system is enabled
- Ensure no conflicting active service hours

### Issue: Multiple Off-Hours Messages
- System includes a 1-hour cooldown for repeat messages
- Check logs for cooldown calculation
- Verify message timestamps in database

## Dependencies

This module depends on:
- `node-cron` for cron expression validation
- `cron-parser` for next occurrence calculations
- `moment-timezone` for timezone-aware operations
- Integration with ticket and AI modules