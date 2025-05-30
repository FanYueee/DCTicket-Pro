# DCTicket Pro

A powerful Discord ticket bot with modular architecture, AI-powered support, and comprehensive management features. DCTicket Pro provides professional customer support functionality for Discord servers with advanced AI integration, WHMCS support, and flexible configuration options.

## 🌟 Key Features

### 🎫 **Advanced Ticket System**
- **Interactive Panels**: Beautiful ticket creation panels with department-specific buttons
- **Multi-Department Support**: Tech support, billing, and general inquiries
- **Smart Permissions**: Automatic permission management for users and staff
- **Guest Invitation**: Ticket creators and staff can invite additional users to collaborate
- **Status Tracking**: Open → Waiting for Staff → Closed workflow
- **Transcript System**: Automatic conversation archiving with export functionality

### 🤖 **AI-Powered Support**
- **Google Gemini Integration**: Automated responses using cutting-edge AI
- **Multimodal Capabilities**: Analyze text, images, and documents
- **Context-Aware Responses**: Department-specific AI prompts
- **Smart Handoff**: Seamless transition from AI to human support
- **Conversation Memory**: Maintains context throughout the ticket

### 🕐 **Service Hours Management**
- **Business Hours**: Define operating hours with timezone support
- **Holiday System**: Configure one-time and recurring holidays
- **Smart Notifications**: Automated off-hours messages
- **Flexible Scheduling**: Cron-based schedule configuration

### 💼 **WHMCS Integration**
- **Service Display**: Show customer services directly in tickets
- **Status Classification**: Active/inactive service categorization
- **Control Panel Links**: Quick access to service management
- **Discord Account Linking**: Seamless integration with WHMCS users

### 📊 **Management Features**
- **Role-Based Access**: Configure staff roles per department
- **Category Organization**: Automatic channel categorization
- **Message Archiving**: Complete conversation history
- **Staff Reminder System**: Automatic notifications for unresponded tickets
- **Modular Architecture**: Enable/disable features as needed

## 📋 Requirements

- Node.js 16.x or higher
- Discord.js v14
- SQLite3
- Google Gemini API Key (for AI features)
- WHMCS instance with API access (optional)

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone https://github.com/fanyueee/DCTicket-Pro.git
cd DCTicket-Pro
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
Create a `.env` file in the root directory:

```env
# Discord Configuration
DISCORD_TOKEN=your-bot-token
CLIENT_ID=your-client-id
GUILD_ID=your-guild-id

# AI Integration (Optional)
GEMINI_API_KEY=your-gemini-api-key

# WHMCS Integration (Optional)
WHMCS_ENABLED=true
WHMCS_API_URL=https://your-whmcs.com/includes/api.php
WHMCS_API_IDENTIFIER=your-api-identifier
WHMCS_API_SECRET=your-api-secret
WHMCS_PANEL_URL=https://your-panel.com

# Timezone
TIMEZONE=Asia/Taipei
```

### 4. Configure the Bot
Edit `src/core/config.js` to customize:
- Department names and roles
- AI prompts and behavior
- Service hours and holidays
- Feature toggles

### 5. Deploy Commands
```bash
npm run deploy
```

### 6. Start the Bot
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## 📁 Project Structure

```
DCTicket/
├── src/
│   ├── core/               # Core functionality
│   │   ├── bot.js         # Main bot class
│   │   ├── config.js      # Configuration
│   │   ├── database.js    # Database management
│   │   └── logger.js      # Logging system
│   ├── modules/           # Feature modules
│   │   ├── ai/           # AI integration
│   │   ├── service-hours/ # Business hours
│   │   ├── ticket/       # Ticket system
│   │   └── whmcs/        # WHMCS integration
│   ├── utils/            # Utility functions
│   ├── index.js          # Entry point
│   └── deploy-commands.js # Command deployment
├── data/                 # SQLite database
├── logs/                 # Application logs
└── package.json
```

## 🛠️ Configuration

### Basic Configuration
The main configuration file is `src/core/config.js`. Key settings include:

```javascript
module.exports = {
  // Bot settings
  botName: 'DCTicket Pro',
  timezone: 'Asia/Taipei',
  
  // Ticket departments
  departments: {
    tech: { name: '技術支援', emoji: '🛠️' },
    billing: { name: '帳務問題', emoji: '💰' },
    general: { name: '一般諮詢', emoji: '📋' }
  },
  
  // Staff roles (configure these IDs)
  staffRoles: {
    tech: 'TECH_ROLE_ID',
    billing: 'BILLING_ROLE_ID',
    general: 'GENERAL_ROLE_ID'
  }
};
```

### AI Configuration
Configure AI behavior in the `ai` section:

```javascript
ai: {
  enabled: true,
  model: 'gemini-2.0-flash',
  temperature: 0.7,
  maxOutputTokens: 1024
}
```

### Service Hours
Set business hours and holidays:

```javascript
serviceHours: {
  enabled: true,
  defaultSchedule: '0 9-18 * * 1-5', // Mon-Fri 9AM-6PM
  timezone: 'Asia/Taipei'
}
```

## 📝 Commands

### Ticket Commands
- `/setup` - Create a ticket panel in the current channel
- `/close` - Close the current ticket
- `/invite [user]` - Invite a user to view and participate in current ticket
- `/transfer [department]` - Transfer ticket to another department
- `/category create` - Create department categories
- `/role set` - Configure staff roles

### Reminder Commands
- `/reminder enable` - Enable ticket reminder notifications
- `/reminder disable` - Disable ticket reminder notifications
- `/reminder setrole [role]` - Set the role to receive reminders
- `/reminder settimeout [minutes]` - Set reminder timeout (1-60 minutes)
- `/reminder setmode [mode]` - Set reminder mode (once/continuous/limited)
- `/reminder setinterval [seconds]` - Set repeat interval (30-600 seconds)
- `/reminder setmaxcount [count]` - Set maximum reminder count (1-10)
- `/reminder preference [receive]` - Set personal reminder preference
- `/reminder setstaff [user] [receive]` - Admin: Set staff reminder preference
- `/reminder status` - View current reminder settings
- `/reminder debug` - Admin: Debug reminder functionality

### AI Commands
- `/aiprompt view [department]` - View current AI prompt
- `/aiprompt edit [department]` - Edit department prompt
- `/aiprompt savetofile [department]` - Save prompt to file
- `/aiprompt loadfromfile [department]` - Load prompt from file
- `/analyze` - Analyze ticket conversation
- `AI Analysis` - Right-click message for AI analysis (supports text, images, files)

### Service Commands
- `/services [user]` - Display user's WHMCS services
- `/hours view` - View current service hours
- `/hours set` - Configure service hours
- `/hours holiday` - Manage holidays

## 🔧 Module System

DCTicket uses a modular architecture. Each module can be enabled/disabled independently:

### Enabling/Disabling Modules
In `config.js`, set module status:

```javascript
ai: { enabled: true },
whmcs: { enabled: false },
serviceHours: { enabled: true }
```

### Creating Custom Modules
Modules follow a standard structure:
```
module-name/
├── index.js       # Module entry point
├── service.js     # Business logic
├── repository.js  # Data access
├── commands/      # Slash commands
└── README.md      # Documentation
```

## 🌐 AI Prompt Management

### File-Based Prompts
Store complex prompts in files:
```
src/modules/ai/prompts/
├── default.txt
├── general/prompt.txt
├── billing/prompt.txt
└── tech/prompt.txt
```

### Prompt Priority
1. File system prompts
2. Database prompts
3. Config file defaults

## 🔒 Security

- API keys stored in environment variables
- Permission checks on all commands
- Secure ticket access control
- No logging of sensitive data
- Automatic cleanup of temporary files

## 📊 Logging

Logs are organized by module:
```
logs/
├── combined.log     # All logs
├── error.log       # Error logs only
├── ai/            # AI module logs
└── whmcs/         # WHMCS module logs
```

## 🚀 Advanced Features

### Multimodal AI Analysis
- Support for text message analysis
- Image content recognition and analysis
- Code file review
- Document content understanding

### Smart Conversation Management
- Automatic conversation context saving
- History preservation during department transfers
- Seamless AI to human conversation handoff
- Duplicate response prevention mechanism

### Staff Reminder System
- **Automatic Monitoring**: Continuously checks for unresponded tickets
- **Three Reminder Modes**: Once, continuous, or limited count reminders
- **Service Hours Integration**: Only sends reminders during business hours and non-holiday periods
- **Individual Preferences**: Staff can choose whether to receive reminders
- **Role Management**: Automatically manages reminder role assignments
- **Real-time Tracking**: Starts timing from when tickets are transferred to human staff

### Holiday Management System
- One-time holiday settings
- Recurring holidays (e.g., every Sunday)
- Custom holiday messages
- AI behavior adjustment during holidays

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📞 Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/fanyueee/DCTicket-Pro/issues) page.

## 💡 Usage Tips

### Initial Setup
1. Ensure all necessary role IDs are correctly configured
2. Recommend testing on a test server first
3. Carefully read the README files for each module

### Best Practices
- Regularly backup database files (`data/` directory)
- Monitor log files to troubleshoot issues
- Adjust AI temperature parameters based on actual needs
- Set department-specific prompts for different departments

### Troubleshooting
- Check `logs/error.log` for error messages
- Confirm all environment variables are correctly set
- Verify the bot has sufficient permissions
- Use `/analyze` command to diagnose AI behavior
- Use `/reminder debug` to check reminder system status
- Ensure reminder roles are correctly set and exist

### Reminder System Usage Guide
1. **Initial Setup**: First use `/reminder setrole` to set the reminder role
2. **Enable Feature**: Use `/reminder enable` to activate the reminder system
3. **Adjust Parameters**: Set reminder time and mode as needed
4. **Staff Management**: Have staff use `/reminder preference` to set personal preferences
5. **Monitor Operation**: Use `/reminder status` to check configuration status

### Reminder Mode Explanations
- **once (Single)**: Remind only once per ticket, suitable for general use
- **continuous (Continuous)**: Keep reminding until staff responds, suitable for high-priority support
- **limited (Limited)**: Limit the number of reminders, balancing reminder effectiveness with message interference

---

Made with ❤️ for the Discord community