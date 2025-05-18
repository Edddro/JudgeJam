import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const client = new MongoClient(process.env.MONGODB);
const db = client.db('github_repos');
const descriptions = db.collection('descriptions');

export async function scrapeDescription(url, owner, repo) {
  try {
    await client.connect();

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    let description = '';

    if (url.includes('devpost.com')) {
      description = $('#app-details.content-section').text().trim();
    } else if (url.includes('dorahacks.io')) {
      description = $('.main-markdown.markdown-buidl').text().replace(/\s+/g, ' ').trim();
    } else {
      throw new Error('Unsupported URL');
    }

    const owner_repo = `${owner}_${repo}`;

    await descriptions.updateOne(
      { owner_repo },
      {
        $set: {
          owner_repo,
          owner,
          repo,
          url,
          description,
          fetched_at: new Date()
        }
      },
      { upsert: true }
    );

    console.log(`Saved description for ${owner_repo}`);
    return description;

  } catch (error) {
    console.error('Error:', error.message);
    return null;
  } finally {
    await client.close();
  }
}