const { ContextMenuCommandBuilder, ApplicationCommandType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { pipeline } = require('stream/promises');
const https = require('https');
const logger = require('../../../core/logger');
const gemini = require('../gemini');
const aiLogger = require('../ai-logger');

module.exports = {
  analysisPrompt: "請分析以下內容，並提供詳細的見解：",
  
  data: new ContextMenuCommandBuilder()
    .setName('AI 分析')
    .setType(ApplicationCommandType.Message)
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: false });

    try {
      // Get the target message
      const message = interaction.targetMessage;
      let content = message.content || '';
      let fileContent = '';
      let fileAttached = false;

      // Check if the message has attachments
      if (message.attachments.size > 0) {
        // Get the first attachment
        const attachment = message.attachments.first();
        
        try {
          // Check file type
          const fileType = getFileType(attachment);
          
          // Download and process file based on type
          fileContent = await processAttachment(attachment, fileType);
          fileAttached = true;
          
          logger.info(`Successfully downloaded and processed attachment: ${attachment.name} (${fileType})`);
        } catch (error) {
          logger.error(`Error processing attachment: ${error.message}`);
          await interaction.editReply({
            content: '無法處理訊息附件。支援的格式僅包括：文字檔案(.txt, .js, .py等) 和 圖片檔案(.jpg, .png)。'
          });
          return;
        }
      }

      // Initialize Gemini if not already initialized
      if (!gemini.isInitialized()) {
        await gemini.initialize();
        if (!gemini.isInitialized()) {
          await interaction.editReply({
            content: 'AI 分析功能目前無法使用，請稍後再試。'
          });
          return;
        }
      }

      // Generate a unique ID for this analysis
      const analysisId = `analysis-${Date.now()}`;

      // Send to AI for analysis (without context/history)
      logger.info(`Sending message for AI analysis, ID: ${analysisId}`);
      
      // Prepare chat history based on content type
      let chatHistory;
      let analysisContent;
      
      // Check if we have an image attachment
      const isImageAttachment = message.attachments.size > 0 && 
        getFileType(message.attachments.first()) === 'image';
      
      if (isImageAttachment) {
        // Get the first attachment (should be an image)
        const attachment = message.attachments.first();
        
        // We need to download the image and convert it to base64
        const tempDir = os.tmpdir();
        const fileExtension = path.extname(attachment.name) || '.jpg';
        const tempFilePath = path.join(tempDir, `attachment-${Date.now()}${fileExtension}`);
        
        try {
          // Download the image
          await downloadFile(attachment.url, tempFilePath);
          
          // Read the image file as binary data
          const imageBuffer = fs.readFileSync(tempFilePath);
          
          // Convert to base64
          const base64Image = imageBuffer.toString('base64');
          
          // Create the content for logging
          analysisContent = content ? 
            `${content}\n\n[附加圖片: ${attachment.name}]` : 
            `[附加圖片: ${attachment.name}]`;
          
          // Log the content being analyzed (we can't log binary image data)
          aiLogger.logUserMessage(analysisId, null, analysisContent || '(image analysis)');
          
          // Create a multimodal chat history with text and image parts
          chatHistory = [{
            role: 'user',
            parts: [
              { text: module.exports.analysisPrompt + (content ? `\n\n${content}` : '') },
              { 
                inlineData: {
                  mimeType: attachment.contentType || 'image/jpeg',
                  data: base64Image
                }
              }
            ]
          }];
          
          // Clean up
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          
          logger.info(`Successfully processed image for AI analysis: ${attachment.name}`);
        } catch (error) {
          logger.error(`Error processing image for AI analysis: ${error.message}`);
          
          // Clean up on error
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
          
          await interaction.editReply({
            content: '處理圖片時發生錯誤，請稍後再試。'
          });
          return;
        }
      } else {
        // Handle text content as before
        analysisContent = content;
        if (fileAttached && fileContent) {
          analysisContent = content ? `${content}\n\n文件內容：\n${fileContent}` : fileContent;
        }

        if (!analysisContent.trim()) {
          await interaction.editReply({
            content: '無法分析空白訊息，請確保訊息包含文字或有效的文字檔案附件。'
          });
          return;
        }
        
        // Log the content being analyzed
        aiLogger.logUserMessage(analysisId, null, analysisContent);

        // Format for a single message analysis - no chat history, just a direct request
        analysisContent = `${module.exports.analysisPrompt}\n\n${analysisContent}`;
        
        chatHistory = [{
          role: 'user',
          parts: analysisContent
        }];
      }

      // Generate response from Gemini without using context management
      const response = await gemini.generateResponse(
        chatHistory,
        null,
        null,
        null,
        analysisId
      );

      // Log the AI response with the full prompt included
      aiLogger.logResponse(analysisId, null, analysisContent || '(image analysis)', response);

      // Check if response exceeds Discord's 2000 character limit
      if (response.length > 2000) {
        // Split the response into chunks that fit within Discord's limits (max 2000 chars)
        const chunks = [];
        let currentChunk = '';
        const sentences = response.split(/(?<=[.!?])\s+/); // Split by sentence endings

        for (const sentence of sentences) {
          // If adding this sentence would exceed the limit, push current chunk and start a new one
          if (currentChunk.length + sentence.length > 1900) { // 1900 to leave some margin
            if (currentChunk.length > 0) {
              chunks.push(currentChunk);
              currentChunk = sentence;
            } else {
              // If a single sentence is longer than the limit, split it
              const words = sentence.split(' ');
              for (const word of words) {
                if (currentChunk.length + word.length + 1 > 1900) {
                  chunks.push(currentChunk);
                  currentChunk = word + ' ';
                } else {
                  currentChunk += word + ' ';
                }
              }
            }
          } else {
            currentChunk += sentence + ' ';
          }
        }

        // Add any remaining content
        if (currentChunk.length > 0) {
          chunks.push(currentChunk);
        }
        
        // Send the first chunk as the initial reply
        await interaction.editReply({
          content: chunks[0] + '\n\n(回應較長，持續展示中...)'
        });
        
        // Send the rest as follow-up messages
        for (let i = 1; i < chunks.length; i++) {
          const isLast = i === chunks.length - 1;
          const chunkPrefix = isLast ? '(最終部分)' : `(部分 ${i+1}/${chunks.length})`;
          
          try {
            await interaction.followUp({
              content: `${chunkPrefix}\n\n${chunks[i]}`,
              ephemeral: false
            });
          } catch (error) {
            logger.error(`Error sending message chunk: ${error.message}`);
          }
        }
      } else {
        // Send the response to the user (fits within Discord limit)
        await interaction.editReply({
          content: response
        });
      }

      logger.info(`AI analysis completed for ID: ${analysisId}`);

    } catch (error) {
      logger.error(`Error in AI analysis: ${error.message}`);
      await interaction.editReply({
        content: '進行 AI 分析時發生錯誤，請稍後再試。'
      });
    }
  }
};

/**
 * Determine the file type based on attachment properties
 * @param {Object} attachment - The Discord attachment object
 * @returns {string} The identified file type
 */
function getFileType(attachment) {
  const name = attachment.name.toLowerCase();
  const contentType = attachment.contentType?.toLowerCase() || '';
  
  // Text files - include common programming and config files
  if (name.endsWith('.txt') || name.endsWith('.log') || contentType.includes('text/plain') ||
      contentType.includes('text/') || contentType.includes('application/javascript') ||
      contentType.includes('application/json') || contentType.includes('application/xml')) {
    return 'text';
  }
  // Images - but excluding GIF
  else if (
    name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || contentType.includes('image/')
  ) {
    return 'image';
  }
  // Unsupported file types
  return 'unsupported';
}

/**
 * Process an attachment based on file type
 * @param {Object} attachment - The Discord attachment object
 * @param {string} fileType - The file type
 * @returns {Promise<string|Object>} The processed content
 */
async function processAttachment(attachment, fileType) {
  // If the file type is unsupported, throw an error
  if (fileType === 'unsupported') {
    throw new Error('Unsupported file type');
  }
  
  // Create a temp file path with appropriate extension
  const tempDir = os.tmpdir();
  const fileExtension = path.extname(attachment.name) || '.bin';
  const tempFilePath = path.join(tempDir, `attachment-${Date.now()}${fileExtension}`);
  
  try {
    // Download the file
    await downloadFile(attachment.url, tempFilePath);
    
    // Process based on file type
    let content = '';
    
    if (fileType === 'text') {
      // Directly read text files
      content = fs.readFileSync(tempFilePath, 'utf8');
    } 
    else if (fileType === 'image') {
      // Note: We keep this for backward compatibility, but the main flow 
      // now uses a more direct approach to process images with multimodal API
      content = `[圖片檔案] ${attachment.name}\n` +
               `類型: ${attachment.contentType || '未知'}\n` +
               `大小: ${formatBytes(attachment.size)}`;
    }
    
    // Clean up
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    
    return content;
  } catch (error) {
    // Clean up on error
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }
    throw error;
  }
}

/**
 * Download a file from a URL
 * @param {string} url - The file URL
 * @param {string} filePath - Where to save the file
 * @returns {Promise<void>}
 */
async function downloadFile(url, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }
      
      pipeline(response, file)
        .then(() => resolve())
        .catch(err => reject(err));
    }).on('error', (err) => {
      fs.unlink(filePath, () => {});
      reject(err);
    });
  });
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - The size in bytes
 * @returns {string} Formatted size
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}