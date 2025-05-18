import os
import json
import uuid
import subprocess
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from urllib.parse import urlparse
import asyncio
import sys

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGODB = os.getenv('MONGODB')
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__)
# Configure CORS to allow requests from your frontend
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

try:
    mongo_client = MongoClient(MONGODB)
    db = mongo_client['github_repos']
    results_col = db['results']
except Exception as e:
    print(f"Failed to connect to MongoDB: {e}")
    mongo_client = None
    db = None
    results_col = None

def run_repo_analysis(owner, repo, desc_url='', event_start_date='2024-01-01T00:00:00Z'):
    backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
    node_script = f'''
import {{ getRepoCreationDate }} from './repo.js';
getRepoCreationDate('{owner}', '{repo}', '{desc_url}', '{event_start_date}')
    .then(result => {{
        console.log(JSON.stringify(result));
        process.exit(0);
    }})
    .catch(error => {{
        console.error(error);
        process.exit(1);
    }});
'''
    temp_script = os.path.join(backend_dir, 'temp_script.mjs')
    with open(temp_script, 'w') as f:
        f.write(node_script)
    
    try:
        result = subprocess.run(['node', temp_script], 
                              cwd=backend_dir,
                              capture_output=True, 
                              text=True)
        os.remove(temp_script)
        if result.returncode != 0:
            raise Exception(f"Node.js script failed: {result.stderr}")
        return json.loads(result.stdout)
    except Exception as e:
        raise Exception(f"Failed to run repo analysis: {str(e)}")

@app.route('/api/submit', methods=['POST'])
def submit():
    try:
        if mongo_client is None or db is None or results_col is None:
            return jsonify({'error': 'Database connection not available'}), 503

        github_url = request.form.get('githubUrl')
        transcript = request.form.get('transcript', '')
        rubric_file = request.files.get('rubric')
        media_file = request.files.get('media')
        desc_url = request.form.get('descriptionUrl')
        event_start_date = request.form.get('eventStartDate')

        # Validate required fields
        if not all([github_url, rubric_file, desc_url, event_start_date]):
            missing_fields = []
            if not github_url:
                missing_fields.append('GitHub URL')
            if not rubric_file:
                missing_fields.append('rubric file')
            if not desc_url:
                missing_fields.append('description URL')
            if not event_start_date:
                missing_fields.append('event start date')
            return jsonify({
                'error': 'Missing required fields',
                'missing_fields': missing_fields
            }), 400

        # Validate description URL format
        if not (desc_url.startswith('https://devpost.com/') or desc_url.startswith('https://dorahacks.io/')):
            return jsonify({
                'error': 'Invalid description URL format',
                'details': 'Description URL must be from DevPost or DoraHacks'
            }), 400

        # Validate event start date format
        try:
            from datetime import datetime
            datetime.fromisoformat(event_start_date.replace('Z', '+00:00'))
        except ValueError:
            return jsonify({
                'error': 'Invalid event start date format',
                'details': 'Event start date must be in ISO format (YYYY-MM-DDTHH:mm:ssZ)'
            }), 400

        # Save rubric file to backend/video directory
        backend_video_dir = os.path.join(os.path.dirname(__file__), '..', 'backend', 'video')
        if not os.path.exists(backend_video_dir):
            os.makedirs(backend_video_dir)
        
        rubric_path = os.path.join(backend_video_dir, 'rubric.pdf')
        rubric_file.save(rubric_path)

        transcript_filename = f"{uuid.uuid4()}_transcript.txt"
        transcript_path = os.path.join(app.config['UPLOAD_FOLDER'], transcript_filename)
        with open(transcript_path, 'w', encoding='utf-8') as f:
            f.write(transcript)

        media_path = None
        if media_file:
            media_filename = secure_filename(str(uuid.uuid4()) + '_' + media_file.filename)
            media_path = os.path.join(app.config['UPLOAD_FOLDER'], media_filename)
            media_file.save(media_path)

        # Parse owner/repo from GitHub URL
        try:
            url = github_url.strip()
            if not url.startswith('http'):
                url = 'https://' + url
            url_obj = urlparse(url)
            parts = url_obj.path.lstrip('/').split('/')
            owner = parts[0]
            repo = parts[1]
        except Exception:
            return jsonify({'error': 'Invalid GitHub URL format'}), 400

        # Create a temporary Node.js script to call repo.js
        backend_dir = os.path.join(os.path.dirname(__file__), '..', 'backend')
        node_script = f'''
import {{ getRepoCreationDate }} from './repo.js';

getRepoCreationDate('{owner}', '{repo}', '{desc_url}', '{event_start_date}')
    .then(result => {{
        console.log(JSON.stringify(result));
        process.exit(0);
    }})
    .catch(error => {{
        console.error(error);
        process.exit(1);
    }});
'''
        temp_script = os.path.join(backend_dir, 'temp_script.mjs')
        
        try:
            # Write temporary script
            with open(temp_script, 'w', encoding='utf-8') as f:
                f.write(node_script)
            
            # Run repo analysis
            result = subprocess.run(
                ['node', temp_script], 
                cwd=backend_dir,
                capture_output=True, 
                text=True,
                encoding='utf-8'
            )
            
            # Clean up temporary script
            try:
                os.remove(temp_script)
            except Exception as e:
                print(f"Warning: Failed to remove temporary script: {e}")
            
            if result.returncode != 0:
                # Try to parse stderr for disqualification info
                try:
                    error_data = json.loads(result.stderr)
                    if error_data.get('isDisqualified'):
                        return jsonify(error_data), 200
                except:
                    pass
                return jsonify({
                    'error': 'Repository analysis failed',
                    'details': result.stderr
                }), 500
                
            repo_analysis = json.loads(result.stdout)
            
            # If the repository is disqualified, return a 200 status with the disqualification info
            if repo_analysis.get('isDisqualified'):
                return jsonify({
                    'message': 'Repository disqualified',
                    'repoAnalysis': repo_analysis
                }), 200
                
        except Exception as e:
            return jsonify({
                'error': 'Failed to analyze repository',
                'details': str(e)
            }), 500

        # Start video analysis if media file exists
        if media_path:
            with open('video_py_out.log', 'a') as out, open('video_py_err.log', 'a') as err:
                subprocess.Popen([
                    'python3', os.path.join('backend', 'video', 'video.py'),
                    '--input', media_path
                ], stdout=out, stderr=err, close_fds=True)

        # Store result in MongoDB
        doc = {
            'owner': owner,
            'repo': repo,
            'githubUrl': github_url,
            'descriptionUrl': desc_url,
            'eventStartDate': event_start_date,
            'rubricPath': rubric_path,
            'transcriptPath': transcript_path,
            'mediaPath': media_path,
            'repoAnalysis': repo_analysis,
            'createdAt': str(uuid.uuid4())
        }
        
        insert_res = results_col.insert_one(doc)
        result_id = str(insert_res.inserted_id)
        
        return jsonify({
            'message': 'Submission received',
            'resultId': result_id,
            'repoAnalysis': repo_analysis
        })

    except Exception as e:
        print(f"Error in submit endpoint: {e}")
        return jsonify({
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/api/result/<id>', methods=['GET'])
def get_result(id):
    try:
        doc = results_col.find_one({'_id': ObjectId(id)})
        if not doc:
            return jsonify({'error': 'Result not found'}), 404
        doc['_id'] = str(doc['_id'])
        return jsonify(doc)
    except Exception as e:
        return jsonify({'error': 'Failed to fetch result', 'details': str(e)}), 500

if __name__ == '__main__':
    # Use threaded=False to avoid socket issues
    app.run(host='0.0.0.0', port=8124, debug=True, threaded=False) 