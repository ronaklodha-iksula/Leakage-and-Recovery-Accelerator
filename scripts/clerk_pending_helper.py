"""Helper for pending-user tests. Usage:
  create <email>   -> create Clerk user (verified), print user_id
  ticket <user_id> -> sign-in ticket
  jwt <user_id>    -> 1h session JWT
  role <user_id>   -> print db role
  delete <email>   -> delete from Clerk and db.users
  adminemail       -> print ADMIN_EMAIL value only
"""
import os, json, urllib.request, urllib.parse, sys
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")
from pymongo import MongoClient

SK = os.environ["CLERK_SECRET_KEY"]
db = MongoClient(os.environ["MONGO_URL"])[os.environ["DB_NAME"]]


def bapi(path, body=None, method="POST"):
    req = urllib.request.Request("https://api.clerk.com/v1" + path, data=json.dumps(body).encode() if body is not None else None,
                                 method=method, headers={"Authorization": "Bearer " + SK, "Content-Type": "application/json", "User-Agent": "emergent-test"})
    return json.load(urllib.request.urlopen(req))


cmd, arg = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
if cmd == "create":
    lst = bapi("/users?email_address=" + urllib.parse.quote(arg), method="GET")
    u = lst[0] if lst else bapi("/users", {"email_address": [arg], "password": "Test-pass-12345!", "skip_password_checks": True,
                                           "first_name": "TEST", "last_name": arg.split("+")[0]})
    print(u["id"])
elif cmd == "ticket":
    print(bapi("/sign_in_tokens", {"user_id": arg, "expires_in_seconds": 600})["token"])
elif cmd == "jwt":
    s = bapi("/sessions", {"user_id": arg})
    print(bapi(f"/sessions/{s['id']}/tokens", {"expires_in_seconds": 3600})["jwt"])
elif cmd == "role":
    print(db.users.find_one({"user_id": arg}, {"_id": 0, "role": 1, "email": 1}))
elif cmd == "delete":
    lst = bapi("/users?email_address=" + urllib.parse.quote(arg), method="GET")
    for u in lst:
        bapi(f"/users/{u['id']}", method="DELETE")
    print("clerk deleted", len(lst), "db deleted", db.users.delete_many({"email": arg}).deleted_count)
elif cmd == "adminemail":
    print(os.environ.get("ADMIN_EMAIL"))
