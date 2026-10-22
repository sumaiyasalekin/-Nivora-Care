/**
 * Nivora Care - Local Server & ChatterMate API Proxy
 * Runs using only built-in Node.js modules (no npm packages required)
 * Command: node --env-file=.env server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.CHATTERMATE_API_KEY;

const SYSTEM_PROMPT = `You are a hospital report assistant. Answer only from the report data given. Never invent numbers. If the data doesn't have the answer, say so. Money is in Taka (Tk). Keep answers short. You cannot change any data; refuse requests to edit or delete.`;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

// Helper to handle API requests to ChatterMate
function fetchChatterMateModel(apiKey) {
  return new Promise((resolve, reject) => {
    const req = https.request('https://chattermate.ai/api/chat/models', {
      method: 'GET',
      headers: {
        'X-API-Key': apiKey,
        'Accept': 'application/json'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(body);
            resolve(data.default_model_id || (Array.isArray(data) ? data[0]?.id : null));
          } catch (e) {
            reject(new Error('Failed to parse models response from ChatterMate.'));
          }
        } else {
          reject(new Error(`ChatterMate Models API returned status ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function streamChatterMateAnswer(apiKey, modelId, systemPrompt, promptText) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      models: [modelId],
      system_prompt: systemPrompt,
      prompt: promptText
    });

    const req = https.request('https://chattermate.ai/api/chat/stream', {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let rawStream = '';
      let fullAnswer = '';

      res.on('data', chunk => {
        rawStream += chunk.toString('utf8');
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const lines = rawStream.split('\n');
          let currentEvent = '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('event:')) {
              currentEvent = trimmed.replace('event:', '').trim();
            } else if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.replace('data:', '').trim();
              if (dataStr) {
                try {
                  const parsed = JSON.parse(dataStr);
                  if (parsed.content) {
                    fullAnswer += parsed.content;
                  }
                } catch (e) {
                  // Fallback if data is raw string
                  if (currentEvent === 'model_chunk') {
                    fullAnswer += dataStr;
                  }
                }
              }
            }
          }

          resolve(fullAnswer.trim() || "I could not extract an answer from the report data.");
        } else {
          reject(new Error(`ChatterMate API returned status ${res.statusCode}: ${rawStream}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle POST /ask for AI Chat Assistant
  if (req.method === 'POST' && req.url === '/ask') {
    if (!API_KEY || API_KEY.includes('your_actual_key_here')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        error: 'ChatterMate API Key missing or unconfigured. Please add your key to the .env file.' 
      }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { question, data } = JSON.parse(body || '{}');

        if (!question) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Question is required.' }));
          return;
        }

        const modelId = await fetchChatterMateModel(API_KEY);
        if (!modelId) {
          throw new Error('No default model returned by ChatterMate API.');
        }

        const promptText = `Report Data: ${JSON.stringify(data)}\n\nUser Question: ${question}`;
        const answer = await streamChatterMateAnswer(API_KEY, modelId, SYSTEM_PROMPT, promptText);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ answer }));
      } catch (err) {
        console.error('AI Proxy Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal server error while asking AI.' }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  const extname = String(path.extname(filePath)).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === 'ENOENT') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, indexContent) => {
          if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(indexContent, 'utf-8');
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${error.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  Nivora Care Hospital Web App Running`);
  console.log(`  Local URL: http://localhost:${PORT}`);
  console.log(`  API Key:   ${API_KEY ? 'Configured [OK]' : 'MISSING (Set CHATTERMATE_API_KEY in .env)'}`);
  console.log(`====================================================`);
});