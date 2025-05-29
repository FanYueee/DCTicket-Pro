# Ticket System Module

The ticket system is the core module of DCTicket Pro, providing comprehensive customer support functionality through Discord channels. It handles ticket creation, management, staff assignment, and integrates seamlessly with AI and other modules.

## 🎫 Core Features

### Ticket Lifecycle
1. **Creation**: Users click department buttons to create tickets
2. **AI Handling**: Initial automated responses (if AI enabled)
3. **Human Handoff**: Seamless transfer to human staff
4. **Resolution**: Staff can resolve or close tickets
5. **Archiving**: Complete conversation history saved

### Multi-Department Support
- **Tech Support**: Technical issues and troubleshooting
- **Billing**: Payment and account inquiries  
- **General**: General questions and requests
- **Custom Departments**: Configurable via config.js

### Smart Permissions
- Automatic channel permissions for ticket creator
- Department-specific staff role access
- Secure isolation between tickets

## 📋 Commands

### Setup Commands
- `/setup` - Create a ticket panel in the current channel
- `/category create [department]` - Create department category channels
- `/role set [department] [role]` - Configure department staff roles

### Management Commands  
- `/close` - Close the current ticket
- Ticket panel buttons for user interactions
- Staff control buttons in ticket channels

### Reminder Commands
See [Reminder System README](./reminder/README.md) for detailed documentation.

## 🏗️ Architecture

### Controller Layer (`controller.js`)
Handles all user interactions and Discord events:
- Ticket creation workflow
- Button interactions
- Message processing
- Human handoff logic

### Service Layer (`service.js`) 
Business logic and operations:
- Ticket lifecycle management
- Status updates
- Staff assignment
- Data validation

### Repository Layer (`repository.js`)
Database operations:
- CRUD operations for tickets
- Message archiving
- Department management
- Panel tracking

### Reminder System (`reminder/`)
Automated staff notification system:
- Monitors unresponded tickets
- Configurable reminder modes
- Service hours integration
- Individual staff preferences

## 💾 Database Schema

### Core Tables
- `tickets`: Main ticket records
- `departments`: Department configurations  
- `messages`: Conversation history
- `panels`: Ticket panel locations
- `department_roles`: Staff role assignments

### Reminder Tables
- `ticket_reminder_settings`: Guild reminder configuration
- `ticket_response_tracking`: Message tracking for reminders
- `staff_reminder_preferences`: Individual staff settings

## 🔄 Integration Points

### AI Module Integration
- Automatic AI responses for new tickets
- Context-aware conversation handling
- Smart handoff detection
- Service hours notifications

### Service Hours Integration  
- Business hours checking
- Holiday notifications
- Off-hours message handling
- Reminder system coordination

### WHMCS Integration
- Customer service display
- Account linking
- Status checking
- Direct panel access

## ⚙️ Configuration

### Department Setup
```javascript
// config.js
departments: {
  tech: {
    name: '技術支援',
    emoji: '🛠️',
    color: 0x3498db
  },
  billing: {
    name: '帳務問題', 
    emoji: '💰',
    color: 0xe74c3c
  }
}
```

### Staff Roles
```javascript
staffRoles: {
  tech: 'ROLE_ID_HERE',
  billing: 'ROLE_ID_HERE',
  general: 'ROLE_ID_HERE'
}
```

### Channel Categories
```javascript
useCategoryChannels: true // Organizes tickets in categories
```

## 🚀 Usage Flow

### For Customers
1. Click department button on ticket panel
2. Fill out issue description in modal
3. Receive immediate channel access
4. Get AI assistance (if enabled)
5. Escalate to human staff if needed
6. Receive resolution and transcript

### For Staff
1. Receive notifications for new tickets
2. Monitor department channels
3. Respond to customer inquiries
4. Use control buttons to manage tickets
5. Close tickets when resolved

### For Administrators
1. Set up ticket panels in channels
2. Configure department roles
3. Manage reminder settings
4. Monitor system status
5. Export ticket transcripts

## 🔧 Advanced Features

### Automatic Archiving
- All messages saved to database
- Includes attachments and embeds
- Searchable conversation history
- Export functionality for staff

### Smart Status Management
- **Open**: New ticket, AI handling
- **Waiting Staff**: Human assistance required
- **Closed**: Issue resolved

### Permission Management
- Dynamic channel permissions
- Role-based access control
- Secure ticket isolation
- Staff override capabilities

### Transcript System
- Automatic conversation export
- Sent to users on ticket close
- Formatted for readability
- Includes all message history

## 📊 Monitoring & Analytics

### Reminder System
- Tracks response times
- Monitors staff activity
- Configurable notification thresholds
- Individual performance tracking

### Message Tracking
- Customer message timestamps
- Staff response tracking
- Conversation flow analysis
- Service quality metrics

## 🛠️ Troubleshooting

### Common Issues
1. **Tickets not creating**: Check permissions and panel setup
2. **Staff not notified**: Verify role configuration
3. **AI not responding**: Check AI module configuration
4. **Reminders not working**: Verify reminder system setup

### Debug Tools
- `/reminder debug` - System status check
- Console logging for development
- Database query monitoring
- Error tracking and reporting

## 🔒 Security Considerations

### Data Protection
- Secure message storage
- Permission-based access
- No logging of sensitive data
- Automatic cleanup procedures

### Access Control
- Role-based permissions
- Channel isolation
- Staff verification
- Admin-only configuration

## 📈 Performance

### Optimization
- Efficient database queries
- Minimal Discord API calls
- Smart caching strategies
- Resource usage monitoring

### Scalability
- Handles multiple concurrent tickets
- Supports large Discord servers
- Modular architecture
- Database indexing for performance

## 🔄 Migration & Backup

### Data Export
- Complete ticket history
- Message archives
- Configuration backup
- Role mapping preservation

### Import Procedures
- Database migration scripts
- Configuration restoration
- Permission reconfiguration
- Validation procedures