import os
import shutil
import subprocess
import time

commits = [
    {
        "version": "74",
        "msg_title": "feat(plans): add subscription plan foundation",
        "msg_body": "- Define subscription plan constants and identifiers\n- Add centralized plan configuration\n- Introduce reusable plan utility helpers\n- Prepare scalable foundation for future plans",
        "files": [
            ("backend/src/config/constants.js", "constants.js"),
            ("backend/src/config/plans.js", "plans.js"),
            ("backend/src/utils/planUtils.js", "planUtils.js"),
        ]
    },
    {
        "version": "75",
        "msg_title": "feat(users): add subscription support to user model",
        "msg_body": "- Add subscription plan fields to User model\n- Implement default plan assignment\n- Track subscription lifecycle information\n- Add plan history and management methods",
        "files": [
            ("backend/src/models/User.js", "User.js")
        ]
    },
    {
        "version": "76",
        "msg_title": "feat(plans): implement backend subscription APIs",
        "msg_body": "- Add plan validation\n- Implement plan management service\n- Create plan controller\n- Expose subscription plan endpoints",
        "files": [
            ("backend/src/validators/plan.validator.js", "plan.validator.js"),
            ("backend/src/services/plan.service.js", "plan.service.js"),
            ("backend/src/controllers/plan.controller.js", "plan.controller.js"),
            ("backend/src/routes/plan.routes.js", "plan.routes.js"),
            ("backend/src/routes/index.js", "index.js")
        ]
    },
    {
        "version": "77",
        "msg_title": "feat(plans): add frontend API integration",
        "msg_body": "- Add subscription API client\n- Implement reusable plan hooks\n- Create shared frontend plan constants\n- Add plan comparison utilities",
        "files": [
            ("frontend/src/constants/plans.js", r"mnt\user-data\outputs\frontend\src\constants\plans.js"),
            ("frontend/src/services/api/plans.js", r"mnt\user-data\outputs\frontend\src\services\api\plans.js"),
            ("frontend/src/hooks/usePlans.js", "usePlans.js"),
            ("frontend/src/utils/planCompare.js", "planCompare.js")
        ]
    },
    {
        "version": "78",
        "msg_title": "feat(plans): build reusable subscription UI components",
        "msg_body": "- Add reusable plan badge component\n- Create plan information card\n- Build current subscription summary\n- Keep components reusable across the application",
        "files": [
            ("frontend/src/components/ui/PlanBadge.jsx", "PlanBadge.jsx"),
            ("frontend/src/features/plans/PlanCard.jsx", "PlanCard.jsx"),
            ("frontend/src/features/plans/CurrentPlanSummary.jsx", "CurrentPlanSummary.jsx")
        ]
    },
    {
        "version": "79",
        "msg_title": "feat(plans): implement upgrade experience",
        "msg_body": "- Add upgrade prompt component\n- Create subscription change modal\n- Improve modal layout for plan comparison\n- Prepare UI for future payment integration",
        "files": [
            ("frontend/src/features/plans/UpgradePrompt.jsx", "UpgradePrompt.jsx"),
            ("frontend/src/features/plans/PlanChangeModal.jsx", "PlanChangeModal.jsx"),
            ("frontend/src/components/ui/Modal.jsx", "Modal.jsx")
        ]
    },
    {
        "version": "80",
        "msg_title": "feat(billing): add subscription management page",
        "msg_body": "- Create billing page\n- Register billing route\n- Integrate billing into application routing\n- Display current subscription information",
        "files": [
            ("frontend/src/pages/Billing.jsx", "Billing.jsx"),
            ("frontend/src/constants/routes.js", "routes.js"),
            ("frontend/src/App.jsx", "App.jsx")
        ]
    },
    {
        "version": "81",
        "msg_title": "feat(layout): surface subscription status in navigation",
        "msg_body": "- Display current subscription plan in sidebar\n- Add billing navigation entry\n- Expose subscription plan through auth context\n- Show upgrade prompt for free plan users",
        "files": [
            ("frontend/src/context/AuthContext.jsx", "AuthContext.jsx"),
            ("frontend/src/components/layout/Sidebar.jsx", "Sidebar.jsx")
        ]
    }
]

source_dir = r"D:\Programming\Major Projects\Website Monitor\files"
repo_dir = r"D:\Programming\Major Projects\Website Monitor\Test"
updates_dir = r"D:\Programming\Major Projects\Website Monitor\Updates\V2"

commit_hashes = []

# To handle casing mapping
def find_file_case_insensitive(directory, target_filename):
    # Only search the direct directory level if it doesn't contain a slash, otherwise search properly
    if '\\' in target_filename or '/' in target_filename:
        # Just resolve it case-insensitively if possible, but actually we have exact casing from mnt/... so direct path is fine.
        return os.path.join(directory, target_filename)
        
    for f in os.listdir(directory):
        if f.lower() == target_filename.lower():
            return os.path.join(directory, f)
    return os.path.join(directory, target_filename) # fallback

for commit in commits:
    version = commit["version"]
    for dest, src in commit["files"]:
        if '\\' in src or '/' in src:
            src_path = os.path.join(source_dir, src)
        else:
            src_path = find_file_case_insensitive(source_dir, src)
            
        dest_path = os.path.join(repo_dir, dest)
        
        # ensure dir exists
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        
        shutil.copy2(src_path, dest_path)
        print(f"Copied {src_path} to {dest_path}")
        
    subprocess.run(["git", "add", "."], cwd=repo_dir, check=True)
    msg = f"Done V2.{version} - {commit['msg_title']}\n\n{commit['msg_body']}"
    subprocess.run(["git", "commit", "-m", msg], cwd=repo_dir, check=True)
    
    res = subprocess.run(["git", "rev-parse", "HEAD"], cwd=repo_dir, capture_output=True, text=True, check=True)
    commit_hashes.append((version, res.stdout.strip(), commit['msg_title'], commit['msg_body']))

for version, commit_hash, msg_title, msg_body in commit_hashes:
    print(f"Checking out {commit_hash} for V2.{version}")
    subprocess.run(["git", "checkout", commit_hash], cwd=repo_dir, check=True)
    
    target_version_dir = os.path.join(updates_dir, version)
    os.makedirs(target_version_dir, exist_ok=True)
    
    for root, dirs, files in os.walk(repo_dir):
        if ".git" in dirs:
            dirs.remove(".git")
        if "node_modules" in dirs:
            dirs.remove("node_modules")
            
        rel_path = os.path.relpath(root, repo_dir)
        if rel_path == ".":
            dest_root = target_version_dir
        else:
            dest_root = os.path.join(target_version_dir, rel_path)
            
        os.makedirs(dest_root, exist_ok=True)
        
        for f in files:
            if f in ["apply_commits.py"]:
                continue
            src_file = os.path.join(root, f)
            dest_file = os.path.join(dest_root, f)
            shutil.copy2(src_file, dest_file)
            
    commit_txt_path = os.path.join(target_version_dir, "commit.txt")
    with open(commit_txt_path, "w") as f:
        f.write(f"{msg_title}\n\n{msg_body}\n")

print("Checking out main branch")
subprocess.run(["git", "checkout", "main"], cwd=repo_dir, check=True)
