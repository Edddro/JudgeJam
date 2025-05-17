import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function scrapeDescription(url) {
  try {
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

    console.log(`Description:\n${description}`);
    return description;

  } catch (error) {
    console.error('Error:', error.message);
    return null;
  }
}

scrapeDescription('https://devpost.com/software/example');
scrapeDescription('https://dorahacks.io/buidl/example');