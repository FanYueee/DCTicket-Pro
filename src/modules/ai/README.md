# AI Integration Module

This module integrates the DCTicket bot with AI services, providing automated customer support, message analysis, and intelligent prompt management.

## Features

- Automated customer support for tickets using Google's Gemini AI
- AI-based analysis of conversation history for ticket debugging
- Department-specific prompts for context-aware responses
- File-based prompt management for complex prompts
- Conversation context tracking for coherent multi-turn interactions
- Support for service hours integration
- Multimodal capabilities: analyze text, images, and files

## Components

### Core Files

- `index.js` - Main module entry point that exports service and repository
- `service.js` - Service layer containing AI business logic
- `repository.js` - Data access layer for AI prompts and conversation contexts
- `gemini.js` - Google Gemini API client implementation
- `context.js` - Conversation context management for maintaining chat history
- `ai-logger.js` - Specialized logging for AI interactions

### Commands

- `/aiprompt` - Manage AI prompts with subcommands:
  - `view [department]` - View current prompt for a department
  - `edit [department]` - Edit a department prompt
  - `savetofile [department]` - Save database prompt to file
  - `loadfromfile [department]` - Load prompt from file to database
  
- `/analyze` - Analyze ticket conversations for debugging:
  - Provides insights into AI decisions
  - Performs sentiment analysis
  - Extracts key topics and themes
  
- Context Menu Commands:
  - `AI 分析` - Right-click on any message to analyze its content
    - Works with text messages
    - Supports image analysis (multimodal capabilities)
    - Can process text files for code and document analysis

### Prompt Management

Prompts are stored in a structured directory hierarchy:

```
/src/modules/ai/prompts/
  ├─ default.txt          # Default prompt for all departments
  ├─ general/             # General service department
  │   └─ prompt.txt
  ├─ billing/             # Billing department
  │   └─ prompt.txt
  └─ tech/                # Technical support department
      └─ prompt.txt
```

## Configuration

Add the following section to your `config.js` file:

```javascript
// AI Configuration
ai: {
  enabled: true,
  geminiApiKey: process.env.GEMINI_API_KEY,

  // Default system prompt used for all departments unless overridden
  defaultPrompt: `You are a professional and polite customer service representative.
  Your job is to help users solve their problems or answer their questions.
  Keep your responses concise, helpful, and professional.
  If you cannot answer a question, politely let the user know and suggest transferring to a human agent.
  Do not make up information or provide incorrect guidance.`,

  // Department-specific prompts (fallbacks if not in database or files)
  departmentPrompts: {
    general: `...`,
    billing: `...`,
    tech: `...`
  },

  // AI model configurations
  model: 'gemini-2.0-flash',  // supports multimodal (text+images)
  temperature: 0.7,
  maxOutputTokens: 1024
}
```

Then add the corresponding environment variables to your `.env` file:

```
# AI Integration
GEMINI_API_KEY=your-gemini-api-key
```

## Prompt Priority Order

The system reads prompts in the following order of priority:

1. File system prompts (`/src/modules/ai/prompts/`)
2. Database-stored prompts
3. Configuration file prompts (if the above aren't found)

## Conversation Context

The AI module maintains conversation context to ensure coherent multi-turn interactions:

- Previous messages are stored in a database
- Context includes user and AI messages
- System prompts can be injected for guidance
- Context is ticket-specific, preserving separate conversations

## Service Hours Integration

When the service-hours module is installed, the AI module can:

- Check if the current time is within service hours
- Provide custom off-hours messages
- Adjust AI behavior based on service availability

## Logging

The module has dedicated logging for AI interactions:

- AI prompts are logged with their source
- User messages are logged with the ticket ID
- AI responses are logged for training and debugging
- Conversation context is logged for troubleshooting

## Custom Prompt Management

For complex prompts that may include specific formatting or lengthy instructions, the file-based prompt system allows:

1. Direct editing of prompt files using any text editor
2. UTF-8 encoding for full language support
3. Discord commands to sync between database and files
4. Source tracking to show where prompts are loaded from

## Installation

1. Add the AI configuration to your `config.js` file
2. Set up the required environment variables
3. Run `npm run deploy` to update commands
4. Restart the bot

When enabled, the module will automatically provide AI responses in ticket channels when appropriate.

## Security

- API keys are stored securely in environment variables
- AI is disabled for tickets in "waitingStaff" status
- AI handles message processing asynchronously to prevent blocking
- AI interactions are fully logged for audit purposes
- Images are processed locally and only base64-encoded data is sent to AI API
- Temporary image files are automatically deleted after processing

## Customization

You can customize the AI behavior by:

- Editing department-specific prompts in files or via commands
- Adjusting the temperature parameter for more/less creative responses
- Modifying the token limit for longer/shorter responses
- Implementing custom prompt templates for specific use cases

## Dependencies

This module depends on:
- `@google/generative-ai` for Gemini AI API access
- `moment-timezone` for time-aware operations
- `winston` for logging
- Optional integration with the service-hours module