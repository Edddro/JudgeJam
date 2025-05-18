import fetch from 'node-fetch';
import path from 'path';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const client = new MongoClient(process.env.MONGODB);
const db = client.db('github_repos');
const collection = db.collection('files');

export async function downloadRepoContents(owner, repo) {
  try {
    await client.connect();

    const owner_repo = `${owner}_${repo}`;

    // Get default branch
    const repoData = await (await fetch(`https://api.github.com/repos/${owner}/${repo}`)).json();
    const branch = repoData.default_branch;

    // Get file tree recursively
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    const tree = await treeRes.json();

    for (const file of tree.tree) {
      if (file.type === 'blob' && !file.path.includes('package.json')) {
        const fileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${file.path}`;
        const fileRes = await fetch(fileUrl);
        const content = await fileRes.text();

        await collection.insertOne({
          owner_repo,
          owner,
          repo,
          path: file.path,
          filename: path.basename(file.path),
          content,
          fetched_at: new Date()
        });

        console.log(`Stored: ${file.path}`);
      }
    }

    console.log(`All files from "${owner}/${repo}" stored in MongoDB.`);
  } catch (error) {
    console.error(`Error downloading repo: ${error.message}`);
  } finally {
    await client.close();
  }
}
