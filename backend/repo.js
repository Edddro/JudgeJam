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
      console.log('TEAM DISQUALIFIED: Repository not found');
      return {
        status: 'disqualified',
        message: 'TEAM DISQUALIFIED',
        isValid: false,
        isDisqualified: true,
        reason: 'Repository not found'
      };
    }

    if (!response.ok) {
      console.log('TEAM DISQUALIFIED: Failed to access repository');
      return {
        status: 'disqualified',
        message: 'TEAM DISQUALIFIED',
        isValid: false,
        isDisqualified: true,
        reason: 'Failed to access repository'
      };
    }

    const data = await response.json();
    console.log(`Repository "${owner}/${repo}" was created on: ${data.created_at}`);
    const repoCreatedAt = new Date(data.created_at);
    const eventDate = new Date(eventStartDate);
    const isValid = repoCreatedAt >= eventDate;

    // Immediately return if repository is invalid
    if (!isValid) {
      console.log('TEAM DISQUALIFIED: Repository created before event start');
      return {
        status: 'disqualified',
        message: 'TEAM DISQUALIFIED',
        isValid: false,
        isDisqualified: true,
        reason: 'Repository was created before the event start date',
        details: {
          repoCreatedAt: repoCreatedAt.toISOString(),
          eventStartDate: eventDate.toISOString(),
          timeDifference: eventDate.getTime() - repoCreatedAt.getTime()
        }
      };
    }

    console.log('Repository is valid, proceeding with analysis...');

    // Only proceed with analysis if the repository is valid
    const analysisResults = {
      repoInfo: await downloadRepoContents(owner, repo),
      description: await scrapeDescription(descURL, owner, repo),
      neuralNetwork: await runPythonScript('neuralnetwork.py', [owner, repo])
    };

    return {
      status: 'success',
      message: 'Repository analysis completed',
      isValid: true,
      isDisqualified: false,
      details: {
        repoCreatedAt: repoCreatedAt.toISOString(),
        eventStartDate: eventDate.toISOString(),
        ...analysisResults
      }
    };

  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.log('TEAM DISQUALIFIED: Error during analysis');
    return {
      status: 'disqualified',
      message: 'TEAM DISQUALIFIED',
      isValid: false,
      isDisqualified: true,
      reason: 'Error during repository analysis'
    };
  }
}