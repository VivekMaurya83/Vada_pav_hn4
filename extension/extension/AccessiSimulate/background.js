/**
 * AccessiSimulate - Background Service Worker
 * Handles Groq API calls securely (keeps key out of content scripts).
 */

const GROQ_API_KEY = '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';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'GROQ_ANALYZE') {
    callGroqAPI(request.prompt)
      .then(result => sendResponse({ success: true, text: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});

async function callGroqAPI(prompt) {
  const response = await fetch(GROQ_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an expert web accessibility auditor. You MUST respond with ONLY valid JSON arrays — no markdown, no explanation, no code blocks. Just a raw JSON array.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.1
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API error ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || '[]';
}
