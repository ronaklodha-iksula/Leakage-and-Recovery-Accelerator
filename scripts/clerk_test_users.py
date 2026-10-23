import os, json, urllib.request, sys
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from pymongo import MongoClient

SK = os.environ["CLERK_SECRET_KEY"]
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def bapi(path, body=None, method="POST"):
    req = urllib.request.Request("https://api.clerk.com/v1" + path, data=json.dumps(body).encode() if body is not None else None,
                                 method=method, headers={"Authorization": "Bearer " + SK, "Content-Type": "application/json", "User-Agent": "emergent-test"})
    return json.load(urllib.request.urlopen(req))


USERS = [("admin", "Test Admin"), ("analyst", "Asha Analyst"), ("approver", "Paul Approver"),
         ("assurance", "Ira Assurance"), ("rule_author", "Rita RuleAuthor"), ("viewer_cfo", "Cara CFO")]
out = {}
for role, name in USERS:
    email = f"{role.replace('_', '')}+clerk_test@example.com"
    found = bapi(f"/users?email_address={urllib.parse.quote(email)}", method="GET") if False else None
    try:
        lst = json.load(urllib.request.urlopen(urllib.request.Request(
            "https://api.clerk.com/v1/users?email_address=" + urllib.parse.quote(email),
            headers={"Authorization": "Bearer " + SK, "User-Agent": "emergent-test"})))
    except Exception:
        lst = []
    if lst:
        u = lst[0]
    else:
        first, last = name.split(" ")
        u = bapi("/users", {"email_address": [email], "password": "Test-pass-12345!", "skip_password_checks": True,
                            "first_name": first, "last_name": last})
    db.users.update_one({"user_id": u["id"]}, {"$set": {"user_id": u["id"], "email": email, "name": name, "role": role, "env": "preview"}}, upsert=True)
    out[role] = {"email": email, "user_id": u["id"]}
if len(sys.argv) > 1:
    role = sys.argv[1]
    uid = out[role]["user_id"]
    s = bapi("/sessions", {"user_id": uid})
    print(bapi(f"/sessions/{s['id']}/tokens", {"expires_in_seconds": 3600})["jwt"])
else:
    print(json.dumps(out, indent=1))
