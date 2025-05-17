import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';

export async function downloadRepoContents(owner, repo, outputDir = './downloaded-code') {
  try {
    // Step 1: Get default branch
    const repoData = await (await fetch(`https://api.github.com/repos/${owner}/${repo}`)).json();
    const branch = repoData.default_branch;

    // Step 2: Get file tree recursively
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    const tree = await treeRes.json();

    for (const file of tree.tree) {
      if (file.type === 'blob') {
        const fileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
        const filePath = path.join(outputDir, file.path);
        
        // Create folders if they don't exist
        await fs.mkdir(path.dirname(filePath), { recursive: true });

        // Fetch and save the file content
        const fileRes = await fetch(fileUrl);
        const content = await fileRes.text();
        await fs.writeFile(filePath, content);
        console.log(`Saved: ${file.path}`);
      }
    }

    console.log(`All files from "${owner}/${repo}" downloaded.`);
  } catch (error) {
    console.error(`Error downloading repo: ${error.message}`);
  }
}