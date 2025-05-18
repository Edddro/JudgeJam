import os
import sys
from pymongo import MongoClient
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
MONGO_URI = os.getenv("MONGODB")

# Initialize clients
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
            content = file['content'][:max_file_chars]
            if total_chars + len(content) > max_total_chars:
                break
            selected_code.append(content)
            total_chars += len(content)

    all_code = "\n".join(selected_code)

    prompt = (
        f"The team claims to have used the following technologies:\n"
        f"{', '.join(claimed_technologies)}\n\n"
        f"Here is their project code:\n{all_code}\n\n"
        "For each claimed technology, determine if it is clearly used in the code "
        "(e.g., via import statements, APIs, syntax, or library usage).\n\n"
        "Return your response in JSON with two lists:\n"
        "{\n"
        '  "verified": [list of confirmed technologies],\n'
        '  "missing_or_unconfirmed": [list of technologies not evident in the code]\n'
        "}"
    )

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )

        content = response.choices[0].message.content.strip()

        # Try to parse as JSON-like dict
        try:
            result = eval(content, {"__builtins__": {}})
            if isinstance(result, dict) and "verified" in result and "missing_or_unconfirmed" in result:
                print("\nValidation Result:\n", result, file=sys.stderr)
                return result
            else:
                raise ValueError("Response does not contain required keys.")

        except Exception:
            # Fallback to manual parsing from natural language format
            verified = []
            missing = []
            current = None

            lines = content.splitlines()
            for line in lines:
                line = line.strip()
                if not line:
                    continue
                if line.lower().startswith("the team has used"):
                    current = "verified"
                elif line.lower().startswith("the team has not provided"):
                    current = "missing"
                elif line[0].isdigit() and current:
                    tech_name = line.split(".", 1)[1].strip()
                    tech_name = tech_name.split(" (")[0].strip()
                    if current == "verified":
                        verified.append(tech_name)
                    else:
                        missing.append(tech_name)

            result = {
                "verified": verified,
                "missing_or_unconfirmed": missing
            }
            print("\nParsed fallback result:\n", result, file=sys.stderr)
            return result

    except Exception as e:
        print(f"Error during OpenAI call: {e}", file=sys.stderr)
        return None