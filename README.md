# DCTicket Pro

A powerful Discord ticket bot with modular architecture, AI-powered support, and comprehensive management features. DCTicket Pro provides professional customer support functionality for Discord servers with advanced AI integration, WHMCS support, and flexible configuration options.

## 🌟 Key Features

### 🎫 **Advanced Ticket System**
- **Interactive Panels**: Beautiful ticket creation panels with department-specific buttons
- **Multi-Department Support**: Tech support, billing, and general inquiries
- **Smart Permissions**: Automatic permission management for users and staff
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
- `/category create` - Create department categories
- `/role set` - Configure staff roles

### AI Commands
- `/aiprompt view [department]` - View current AI prompt
- `/aiprompt edit [department]` - Edit department prompt
- `/aiprompt savetofile [department]` - Save prompt to file
- `/aiprompt loadfromfile [department]` - Load prompt from file
- `/analyze` - Analyze ticket conversation

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

---

Made with ❤️ for the Discord community