// ============================================
// AI SERVICE
// Gemini AI integration for message summarization
// ============================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { GEMINI_API_KEY } = require('../config/env');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

/**
 * Format messages for AI consumption
 * @param {Array} messages - Array of message objects
 * @returns {string} - Formatted conversation string
 */
const formatMessages = (messages) => {
  return messages.map(msg => {
    const sender = msg.sender || 'Unknown';
    const timestamp = new Date(msg.timestamp * 1000).toLocaleString();
    const content = msg.content || '';
    
    return `${sender} (${timestamp}): ${content}`;
  }).join('\n');
};

/**
 * Generate summary of messages using Gemini AI
 * @param {Array} messages - Array of message objects
 * @returns {Promise<string>} - AI-generated summary
 */
const summarizeMessages = async (messages) => {
  try {
    // Validate input
    if (!messages || messages.length === 0) {
      return 'No messages available to summarize.';
    }
    
    // Format messages for AI
    const formattedMessages = formatMessages(messages);
    
    // Create prompt
    const prompt = `You are analyzing a WhatsApp conversation. Provide a comprehensive summary covering:

1. **Main Topics**: What are the key subjects discussed?
2. **Key Decisions**: What agreements or conclusions were reached?
3. **Action Items**: What tasks or responsibilities were assigned? (Format: "Name: Task")
4. **Important Updates**: Any significant announcements or information shared?
5. **Overall Tone**: What is the mood/sentiment of the conversation?

Keep the summary concise (150-250 words) but thorough. Use bullet points where appropriate.

Conversation:
${formattedMessages}`;
    
    // Generate summary with Gemini
    const result = await model.generateContent(prompt);
    const summary = await result.response.text();
    
    return summary;
    
  } catch (error) {
    console.error('Gemini AI error:', error);
    
    // Return friendly error message
    if (error.message?.includes('API key')) {
      return 'Error: Invalid Gemini API key. Please check your configuration.';
    }
    
    if (error.message?.includes('quota')) {
      return 'Error: Gemini API quota exceeded. Please try again later.';
    }
    
    return 'Error generating summary. Please try again.';
  }
};

/**
 * Extract key topics from messages
 * @param {Array} messages - Array of message objects
 * @returns {Promise<Array>} - Array of key topics
 */
const extractTopics = async (messages) => {
  try {
    if (!messages || messages.length === 0) {
      return [];
    }
    
    const formattedMessages = formatMessages(messages);
    
    const prompt = `Extract the 3-5 main topics discussed in this WhatsApp conversation. 
Return ONLY a JSON array of topics (no other text).

Example format: ["Planning event", "Budget discussion", "Team roles"]

Conversation:
${formattedMessages}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response.text();
    
    // Try to parse JSON response
    try {
      const topics = JSON.parse(response);
      return Array.isArray(topics) ? topics : [];
    } catch (parseError) {
      // If not valid JSON, extract topics manually
      const topicMatches = response.match(/"([^"]+)"/g);
      return topicMatches ? topicMatches.map(t => t.replace(/"/g, '')) : [];
    }
    
  } catch (error) {
    console.error('Topic extraction error:', error);
    return [];
  }
};

/**
 * Analyze sentiment of conversation
 * @param {Array} messages - Array of message objects
 * @returns {Promise<Object>} - Sentiment analysis
 */
const analyzeSentiment = async (messages) => {
  try {
    if (!messages || messages.length === 0) {
      return { sentiment: 'neutral', confidence: 0 };
    }
    
    const formattedMessages = formatMessages(messages);
    
    const prompt = `Analyze the overall sentiment of this WhatsApp conversation.
Return ONLY a JSON object with this exact format (no other text):
{"sentiment": "positive|neutral|negative", "confidence": 0.0-1.0, "summary": "brief explanation"}

Conversation:
${formattedMessages}`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response.text();
    
    // Try to parse JSON response
    try {
      const sentiment = JSON.parse(response);
      return sentiment;
    } catch (parseError) {
      return { sentiment: 'neutral', confidence: 0.5, summary: 'Unable to analyze' };
    }
    
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    return { sentiment: 'neutral', confidence: 0, summary: 'Error analyzing sentiment' };
  }
};

module.exports = {
  summarizeMessages,
  extractTopics,
  analyzeSentiment,
};