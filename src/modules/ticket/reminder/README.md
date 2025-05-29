# Ticket Reminder System

The ticket reminder system automatically notifies staff members when tickets haven't received a response within a specified timeframe. This ensures timely customer service and helps prevent tickets from being forgotten.

## 🌟 Features

- **Automatic Monitoring**: Continuously checks for unresponded tickets
- **Service Hours Integration**: Only sends reminders during business hours and non-holiday periods
- **Multiple Reminder Modes**: Once, continuous, or limited count reminders
- **Individual Preferences**: Staff can opt-in/out of reminder notifications
- **Role Management**: Automatically manages reminder role assignments
- **Human Handoff Tracking**: Starts monitoring when tickets are transferred to human staff

## ⚙️ Configuration

### 1. Enable Reminder System
```
/reminder enable
```

### 2. Set Reminder Role
```
/reminder setrole @StaffRole
```
This role will be tagged when reminders are sent.

### 3. Configure Timeout
```
/reminder settimeout 10
```
Set how many minutes to wait before sending the first reminder (1-60 minutes).

### 4. Choose Reminder Mode
```
/reminder setmode once        # Send only one reminder
/reminder setmode continuous  # Send reminders indefinitely
/reminder setmode limited     # Send limited number of reminders
```

### 5. Set Intervals (for continuous/limited modes)
```
/reminder setinterval 120     # Wait 2 minutes between reminders (30-600 seconds)
/reminder setmaxcount 5       # Maximum 5 reminders (for limited mode, 1-10)
```

## 👤 Staff Management

### Individual Preferences
Staff members can control their reminder notifications:
```
/reminder preference true     # Receive reminders
/reminder preference false    # Don't receive reminders
```

When staff opt-out, they are automatically removed from the reminder role. When they opt-in, they are added back to the role.

### Admin Management
Administrators can control staff preferences:
```
/reminder setstaff @User true   # Enable reminders for specific user
/reminder setstaff @User false  # Disable reminders for specific user
```

## 🔍 Monitoring

### Check Status
```
/reminder status
```
Shows current configuration and your personal preference.

### Debug Information
```
/reminder debug
```
Admin-only command to view detailed system status.

## 🚀 How It Works

1. **Ticket Creation**: When a ticket is created, it's initially handled by AI (if enabled)

2. **Human Handoff**: When the "Transfer to Human" button is clicked:
   - Ticket status changes to "waitingStaff"
   - Reminder tracking begins with the ticket creation time as the baseline
   - The countdown starts immediately

3. **Message Monitoring**: The system tracks:
   - Customer messages (restarts the reminder countdown)
   - Staff responses (clears reminders and resets counters)

4. **Reminder Logic**: Every 20 seconds, the system checks for tickets that need reminders:
   - Must be in business hours (respects service hours and holidays)
   - Must be transferred to human staff (`human_handled = 1`)
   - Must exceed the timeout period since last customer message
   - Must not have staff response after the last customer message

5. **Notification**: Sends a simple text message with role mention:
   ```
   @StaffRole ⏰ 此工單已經 **10 分鐘**沒有工作人員回應，請盡快處理。
   ```

## 📋 Reminder Modes

### Once Mode (Default)
- Sends one reminder per ticket
- No repeat notifications
- Simple and non-intrusive

### Continuous Mode
- Sends reminders at regular intervals
- Continues until staff responds
- Useful for high-priority support

### Limited Mode
- Sends a maximum number of reminders
- Stops after reaching the limit
- Balances persistence with spam prevention

## 🕐 Service Hours Integration

The reminder system respects your service hours configuration:
- **Business Hours**: Only sends reminders during configured working hours
- **Holidays**: No reminders on configured holiday dates
- **Timezone**: Uses the configured timezone for all time calculations

## 🔧 Technical Details

### Database Tables
- `ticket_reminder_settings`: Stores guild-specific reminder configuration
- `ticket_response_tracking`: Tracks message timestamps and reminder status
- `staff_reminder_preferences`: Individual staff notification preferences

### Performance
- Check interval: Every 20 seconds
- Minimal resource usage when disabled
- Efficient database queries with proper indexing

### Integration Points
- **Ticket System**: Monitors ticket status and handoffs
- **Service Hours**: Checks business hours before sending reminders
- **AI Module**: Detects when tickets are transferred from AI to human staff

## ⚠️ Important Notes

1. **Enabling**: Must set a reminder role before enabling the system
2. **Permissions**: Only administrators can configure system settings
3. **Role Management**: The system automatically manages role assignments based on preferences
4. **Service Hours**: Reminders are automatically disabled outside business hours
5. **Timing**: The system uses a 5-second buffer to prevent missing reminders due to timing issues

## 🛠️ Troubleshooting

### Reminders Not Working
1. Check if reminders are enabled: `/reminder status`
2. Verify reminder role is set and exists
3. Ensure you're within service hours
4. Check if ticket is properly transferred to human staff
5. Use `/reminder debug` for detailed diagnostics

### Too Many/Few Reminders
1. Adjust timeout: `/reminder settimeout [minutes]`
2. Change mode: `/reminder setmode [mode]`
3. Modify interval: `/reminder setinterval [seconds]`
4. Set max count: `/reminder setmaxcount [count]`

### Staff Not Receiving Reminders
1. Check individual preference: `/reminder preference`
2. Verify role assignment in Discord
3. Admin can override: `/reminder setstaff @user true`

## 🔄 Disabling the System

To completely disable reminders:
```
/reminder disable
```

This stops all reminder processing while keeping the 20-second check loop running (for other guilds). The check loop itself consumes minimal resources and allows for quick re-enabling when needed.