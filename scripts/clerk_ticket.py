import os, json, urllib.request, sys
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from pymongo import MongoClient

SK = os.environ["CLERK_SECRET_KEY"]
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]
role = sys.argv[1] if len(sys.argv) > 1 else "admin"
u = db.users.find_one({"role": role, "email": {"$regex": "clerk_test"}})
req = urllib.request.Request("https://api.clerk.com/v1/sign_in_tokens", data=json.dumps({"user_id": u["user_id"], "expires_in_seconds": 600}).encode(),
                             method="POST", headers={"Authorization": "Bearer " + SK, "Content-Type": "application/json", "User-Agent": "emergent-test"})
print(json.load(urllib.request.urlopen(req))["token"])
