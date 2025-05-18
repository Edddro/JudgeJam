import os
import sys
from pymongo import MongoClient
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MONGO_URI = os.getenv("MONGODB")

mongo_client = MongoClient(MONGO_URI)
db = mongo_client["github_repos"]
files_collection = db["files"]
openai_client = OpenAI(api_key=OPENAI_API_KEY)

def validate_technologies(claimed_technologies, project_name, max_total_chars=12000, max_file_chars=2000):
    print(f"\nValidating technologies for project: {project_name}", file=sys.stderr)

    code_files = list(files_collection.find({}))
    if not code_files:
        print("No code files found in the database.", file=sys.stderr)
        return None

    total_chars = 0
    selected_code = []

    for file in code_files:
        if 'content' in file:
            content = file['content'][:max_file_chars]  # Limit per file
            if total_chars + len(content) > max_total_chars:
                break
            selected_code.append(content)
            total_chars += len(content)

    all_code = "\n".join(selected_code)

    prompt = (
        f"The team claims to have used these technologies:\n{', '.join(claimed_technologies)}\n\n"
        f"Here is their project code:\n{all_code}\n\n"
        "Which technologies are clearly used in the code (via import statements, syntax, or usage)?\n"
        "Return:\n"
        "VERIFIED:\n- List of confirmed technologies\n"
        "MISSING OR UNCONFIRMED:\n- List of technologies not evident in the code"
    )

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        result = response.choices[0].message.content.strip()
        print("\n" + result, file=sys.stderr)
        return result

    except Exception as e:
        print(f"Error during OpenAI call: {e}", file=sys.stderr)
        return None