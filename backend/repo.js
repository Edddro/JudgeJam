import { downloadRepoContents } from './repoFiles.js';
import { scrapeDescription } from './submissionDescription.js';
import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runPythonScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'video', scriptName);

    execFile('python3', [scriptPath, ...args], (error, stdout, stderr) => {
      if (error) {
        console.error(`Error executing ${scriptName}:`, error);
        return reject(error);
      }

      if (stderr) {
        console.error(`stderr from ${scriptName}:`, stderr);
      }

      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (e) {
        console.error(`Error parsing output from ${scriptName}:`, e);
        console.log('Raw output:', stdout);
        reject(e);
      }
    });
  });
}

export async function getRepoCreationDate(owner, repo, descURL, eventStartDate) {
  const url = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    const response = await fetch(url);
    if (response.status === 404) {
      throw new Error(`Repository "${owner}/${repo}" not found (404).`);
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Repository "${owner}/${repo}" was created on: ${data.created_at}`);
    const repoCreatedAt = new Date(data.created_at);
    const eventDate = new Date(eventStartDate);
    const isValid = repoCreatedAt >= eventDate;
    console.log('Valid for event:', isValid);

    if (isValid) {
      await downloadRepoContents(owner, repo);
      await scrapeDescription(descURL, owner, repo);

      const nnResult = await runPythonScript('neuralnetwork.py', [owner, repo]);
      console.log('Neural Network Result:', nnResult);
    }

    return isValid;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    throw error;
  }
}

getRepoCreationDate(
  'Edddro',
  'JudgeJam',
  'https://devpost.com/software/homesafe-73n0f2',
  '2023-10-01T00:00:00Z'
);