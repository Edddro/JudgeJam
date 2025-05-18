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

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

MONGODB = os.getenv('MONGODB')
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app = Flask(__name__)
CORS(app)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

mongo_client = MongoClient(MONGODB)
db = mongo_client['github_repos']
results_col = db['results']

@app.route('/api/submit', methods=['POST'])
def submit():
    github_url = request.form.get('githubUrl')
    transcript = request.form.get('transcript', '')
    rubric_file = request.files.get('rubric')
    media_file = request.files.get('media')

    if not github_url or not rubric_file:
        return jsonify({'error': 'GitHub URL and rubric file are required.'}), 400

    # Save files
    rubric_filename = secure_filename(str(uuid.uuid4()) + '_' + rubric_file.filename)
    rubric_path = os.path.join(UPLOAD_FOLDER, rubric_filename)
    rubric_file.save(rubric_path)

    transcript_filename = f"{uuid.uuid4()}_transcript.txt"
    transcript_path = os.path.join(UPLOAD_FOLDER, transcript_filename)
    with open(transcript_path, 'w') as f:
        f.write(transcript)

    media_path = None
    if media_file:
        media_filename = secure_filename(str(uuid.uuid4()) + '_' + media_file.filename)
        media_path = os.path.join(UPLOAD_FOLDER, media_filename)
        media_file.save(media_path)

    # Parse owner/repo from GitHub URL
    try:
        from urllib.parse import urlparse
        url = github_url.strip()
        if not url.startswith('http'):
            url = 'https://' + url
        url_obj = urlparse(url)
        parts = url_obj.path.lstrip('/').split('/')
        owner = parts[0]
        repo = parts[1]
    except Exception:
        return jsonify({'error': 'Invalid GitHub URL.'}), 400

    # Call NeuralNetwork.py
    # args = [
    #     'python3', os.path.join('video', 'NeuralNetwork.py'),
    #     '--rubric', rubric_path,
    #     '--transcript', transcript_path
    # ]
    # if media_path:
    #     args += ['--media', media_path]
    # try:
    #     proc = subprocess.run(args, capture_output=True, text=True, timeout=300)
    #     if proc.returncode != 0:
    #         return jsonify({'error': 'Python analysis failed', 'details': proc.stderr}), 500
    #     result_data = json.loads(proc.stdout)
    # except Exception as e:
    #     return jsonify({'error': 'Failed to run analysis', 'details': str(e)}), 500

    # Start video.py in background
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
        'rubricPath': rubric_path,
        'transcriptPath': transcript_path,
        'mediaPath': media_path,
        'result': 1,
        'createdAt': str(uuid.uuid4())
    }
    insert_res = results_col.insert_one(doc)
    result_id = str(insert_res.inserted_id)
    return jsonify({'message': 'Submission received', 'resultId': result_id})

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
    app.run(host='0.0.0.0', port=8124, debug=True) 