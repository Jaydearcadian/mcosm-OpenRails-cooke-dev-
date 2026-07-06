import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environmental variables from .env
dotenv.config();

const API_KEY = process.env.SPEECHMATICS_API_KEY;
const VOICE_NAME = process.env.SPEECHMATICS_VOICE_NAME || 'sarah';
const OUTPUT_PATH = path.join(import.meta.dirname, '../assets/voiceover.wav');

const textToSpeak = `
Every day, we pay for full monthly subscriptions or flat invoices, even if we only use a service for a few seconds. 
OpenRails is changing that. It’s an intent-driven payment rail that settles value per-second, with zero waste. 
Meet our AI Agent. It needs to run a web crawler to gather research, but giving an autonomous agent a credit card is a massive security risk. 
With OpenRails, we delegate a bounded payment stream: we authorize the agent to spend up to 2 dollars, for exactly 1 hour. 
On the other end is the creator. As the agent crawls their database—or as a fan listens to their music—USDC streams directly to the artist's wallet. 
Look at the balance: it is ticking up second-by-second, representing the exact value delivered in real-time. 
When the task is complete, the stream flushes. The creator gets paid for the exact seconds of work performed, and the unused safety buffer instantly sweeps back to the user's wallet. 
Control without custody.
`;

async function main() {
  if (!API_KEY) {
    console.error('Error: SPEECHMATICS_API_KEY is not defined in your environment or .env file.');
    process.exit(1);
  }

  console.log(`Sending TTS generation request to Speechmatics (Voice: ${VOICE_NAME})...`);

  try {
    const response = await fetch(`https://preview.tts.speechmatics.com/generate/${VOICE_NAME}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: textToSpeak })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Speechmatics API returned HTTP ${response.status}: ${errorText}`);
    }

    // Read the arrayBuffer and write the file
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Ensure assets directory exists
    fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
    
    fs.writeFileSync(OUTPUT_PATH, buffer);
    console.log(`Success! Voiceover audio file saved to: ${OUTPUT_PATH}`);
  } catch (err) {
    console.error('Failed to generate voiceover:', err);
    process.exit(1);
  }
}

main();
