import { downloadRepoContents } from './codefiles.js';
import { scrapeDescription } from './description.js';

async function getRepoCreationDate(owner, repo, descURL, eventStartDate) {
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

      // True if the repo is creatted at or after the event
      const isValid = repoCreatedAt >= eventDate;
      console.log(isValid);
      if (isValid) {
         await downloadRepoContents(owner, repo);
         await scrapeDescription(descURL, owner, repo);
      }
      return isValid;
    } catch (error) {
      console.error(`Error: ${error.message}`);
      throw error;
    }
  }
  
  getRepoCreationDate('Edddro', 'JudgeJam', 'https://devpost.com/software/homesafe-73n0f2', '2023-10-01T00:00:00Z');