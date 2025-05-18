import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { downloadRepoContents } from './codefiles.js';
import { scrapeDescription } from './description.js';
import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

const mongoClient = new MongoClient(process.env.MONGODB);
const dbName = 'github_repos';

// POST /api/submit: Accepts GitHub URL, rubric file, transcript, and media file
app.post('/api/submit', upload.fields([
  { name: 'rubric', maxCount: 1 },
  { name: 'media', maxCount: 1 }
]), async (req, res) => {
  try {
    const { githubUrl, transcript } = req.body;
    const rubricFile = req.files && req.files['rubric'] ? req.files['rubric'][0] : null;
    const mediaFile = req.files && req.files['media'] ? req.files['media'][0] : null;

    if (!githubUrl || !rubricFile) {
      return res.status(400).json({ error: 'GitHub URL and rubric file are required.' });
    }

    // Parse owner/repo from GitHub URL robustly
    let owner = null;
    let repo = null;
    try {
      let url = githubUrl.trim();
      if (!url.startsWith('http')) url = 'https://' + url;
      const urlObj = new URL(url);
      const parts = urlObj.pathname.replace(/^\//, '').split('/');
      owner = parts[0];
      repo = parts[1];
    } catch (e) {
      return res.status(400).json({ error: 'Invalid GitHub URL.' });
    }
    if (!owner || !repo) {
      return res.status(400).json({ error: 'Invalid GitHub URL.' });
    }

    // Download repo contents and scrape description
    await downloadRepoContents(owner, repo);
    // await scrapeDescription('https://devpost.com/software/placeholder', owner, repo);

    // Save rubric file to disk (already in uploads/)
    const rubricPath = rubricFile.path;
    // Save transcript to disk
    const transcriptPath = path.join('uploads', `${Date.now()}_transcript.txt`);
    fs.writeFileSync(transcriptPath, transcript || '');
    // Save media file path
    const mediaPath = mediaFile ? mediaFile.path : null;

    // Call Python analysis script
    const args = [
      'backend/video/NeuralNetwork.py',
      '--rubric', rubricPath,
      '--transcript', transcriptPath
    ];
    if (mediaPath) {
      args.push('--media', mediaPath);
    }
    const pythonProcess = spawn('python3', args);

    let pyOutput = '';
    pythonProcess.stdout.on('data', (data) => {
      pyOutput += data.toString();
    });
    let pyError = '';
    pythonProcess.stderr.on('data', (data) => {
      pyError += data.toString();
    });

    // Start video.py in the background for OpenCV/microphone analysis
    if (mediaPath) {
      const videoPy = spawn('python3', ['backend/video/video.py', '--input', mediaPath], {
        detached: true,
        stdio: ['ignore', fs.openSync('video_py_out.log', 'a'), fs.openSync('video_py_err.log', 'a')]
      });
      videoPy.unref();
    }

    pythonProcess.on('close', async (code) => {
      if (code !== 0) {
        return res.status(500).json({ error: 'Python analysis failed', details: pyError });
      }
      // Parse output (assume JSON string)
      let resultData;
      try {
        resultData = JSON.parse(pyOutput);
      } catch (e) {
        return res.status(500).json({ error: 'Failed to parse analysis result', details: pyOutput });
      }
      // Store result in MongoDB
      try {
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const results = db.collection('results');
        const insertRes = await results.insertOne({
          owner,
          repo,
          githubUrl,
          rubricPath,
          transcriptPath,
          mediaPath,
          result: resultData,
          createdAt: new Date()
        });
        const resultId = insertRes.insertedId;
        return res.json({ message: 'Submission received', resultId });
      } catch (dbErr) {
        return res.status(500).json({ error: 'Failed to store result', details: dbErr.message });
      } finally {
        await mongoClient.close();
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/result/:id: Returns analysis results
app.get('/api/result/:id', async (req, res) => {
  try {
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const results = db.collection('results');
    const result = await results.findOne({ _id: new ObjectId(req.params.id) });
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch result', details: err.message });
  } finally {
    await mongoClient.close();
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`JudgeJam backend server running on port ${PORT}`);
}); 