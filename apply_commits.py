import os
import shutil
import subprocess
import glob

# Configuration
SOURCE_DIR = r"D:\Programming\Major Projects\Website Monitor\files"
TEST_REPO = r"D:\Programming\Major Projects\Website Monitor\Test"
UPDATES_DIR = r"D:\Programming\Major Projects\Website Monitor\Updates\V2"

commits = [
    {
        "version": "88",
        "title": "feat(plans): implement subscription usage infrastructure",
        "message": "- Add centralized usage calculation service\n- Introduce plan validation and usage statistics\n- Prepare reusable usage APIs for future billing\n- Keep all subscription limits sourced from plan configuration\n- Build foundation for plan-based feature enforcement",
        "files": [
            "backend/src/services/usage.service.js",
            "backend/src/controllers/usage.controller.js",
            "backend/src/routes/usage.routes.js",
            "backend/src/routes/index.js"
        ]
    },
    {
        "version": "89",
        "title": "feat(monitors): add monitor ownership model",
        "message": "- Add owner relationship to Monitor model\n- Create indexes for owner-based lookups\n- Prepare monitors for per-user isolation\n- Establish ownership foundation for subscription limits\n- Maintain compatibility with the existing monitor schema",
        "files": [
            "backend/src/models/Monitor.js"
        ]
    },
    {
        "version": "90",
        "title": "feat(monitors): scope monitor operations to owners",
        "message": "- Scope monitor CRUD operations to authenticated users\n- Prevent cross-user monitor access\n- Update monitor controllers for ownership validation\n- Apply owner filtering across monitor endpoints\n- Improve monitor security and data isolation",
        "files": [
            "backend/src/services/monitor.service.js",
            "backend/src/controllers/monitor.controller.js",
            "backend/src/routes/monitor.routes.js"
        ]
    },
    {
        "version": "91",
        "title": "feat(dashboard): scope analytics to owned monitors",
        "message": "- Restrict dashboard data to user-owned monitors\n- Scope incident queries using monitor ownership\n- Prevent cross-user analytics exposure\n- Reuse monitor ownership across reporting services\n- Keep dashboard behavior consistent with monitor access",
        "files": [
            "backend/src/services/dashboard.service.js",
            "backend/src/controllers/dashboard.controller.js",
            "backend/src/services/incident.service.js",
            "backend/src/controllers/incident.controller.js"
        ]
    },
    {
        "version": "92",
        "title": "feat(plans): enforce subscription limits on monitor management",
        "message": "- Enforce monitor count limits based on subscription plans\n- Validate monitoring intervals against plan restrictions\n- Integrate usage validation into monitor creation\n- Return consistent limit exceeded responses\n- Reuse centralized plan utilities for enforcement",
        "files": [
            "backend/src/services/monitor.service.js",
            "backend/src/routes/monitor.routes.js",
            "backend/src/services/usage.service.js"
        ]
    },
    {
        "version": "93",
        "title": "feat(usage): add subscription usage dashboard",
        "message": "- Create usage dashboard with plan statistics\n- Display remaining monitor capacity\n- Add reusable usage indicators\n- Integrate frontend with usage APIs\n- Prepare billing pages for future subscription features",
        "files": [
            "frontend/src/hooks/useUsage.js",
            "frontend/src/components/usage/Usage.jsx",
            "frontend/src/components/usage/UsageDashboard.jsx",
            "frontend/src/components/usage/UsageIndicator.jsx",
            "frontend/src/pages/Billing.jsx"
        ]
    },
    {
        "version": "94",
        "title": "feat(monitors): improve subscription limit experience",
        "message": "- Show limit exceeded messages with upgrade prompts\n- Restrict interval selection based on subscription plans\n- Handle monitor creation limit errors gracefully\n- Add preemptive usage validation in monitor flow\n- Improve subscription-aware monitor management",
        "files": [
            "frontend/src/components/usage/LimitExceededBanner.jsx",
            "frontend/src/components/MonitorFormModal.jsx",
            "frontend/src/hooks/useMonitors.js",
            "frontend/src/pages/Monitors.jsx"
        ]
    },
    {
        "version": "95",
        "title": "chore(subscription): add monitor ownership migration",
        "message": "- Add migration script for existing monitor ownership\n- Register migration command in package scripts\n- Prepare existing data for ownership-based limits\n- Support safe deployment of subscription features\n- Document required migration before production rollout",
        "files": [
            "backend/scripts/migrateMonitorOwners.js",
            "backend/package.json"
        ]
    }
]

def find_source_file(basename):
    for f in os.listdir(SOURCE_DIR):
        if f.lower() == basename.lower():
            return os.path.join(SOURCE_DIR, f)
    return None

def run_cmd(cmd, cwd=TEST_REPO):
    print(f"Running: {cmd} in {cwd}")
    subprocess.run(cmd, cwd=cwd, shell=True, check=True)

def main():
    os.chdir(TEST_REPO)
    
    # 1-3. Apply commits
    for commit in commits:
        print(f"Applying commit V2.{commit['version']}...")
        package_json_dirs = set()
        
        for file_path in commit["files"]:
            basename = os.path.basename(file_path)
            src_file = find_source_file(basename)
            
            if not src_file:
                print(f"WARNING: Source file for {basename} not found!")
                continue
                
            dest_file = os.path.join(TEST_REPO, file_path)
            os.makedirs(os.path.dirname(dest_file), exist_ok=True)
            
            shutil.copy2(src_file, dest_file)
            print(f"Copied {src_file} -> {dest_file}")
            
            if basename.lower() == "package.json":
                package_json_dirs.add(os.path.dirname(dest_file))
                
        for pkg_dir in package_json_dirs:
            print(f"Running npm install in {pkg_dir}")
            run_cmd("npm install", cwd=pkg_dir)
            
        # Git commit
        full_message = f"Done V2.{commit['version']} - {commit['title']}\n\n{commit['message']}"
        run_cmd("git add .")
        # Use a temporary file for the commit message to avoid quote escaping issues
        with open("temp_commit_msg.txt", "w", encoding="utf-8") as f:
            f.write(full_message)
        run_cmd('git commit --allow-empty -F temp_commit_msg.txt')
        os.remove("temp_commit_msg.txt")

    # 4-8. Save snapshots
    # Get git log hashes
    log_output = subprocess.check_output('git log --format="%H|%s"', shell=True, cwd=TEST_REPO, text=True)
    commits_by_version = {}
    for line in log_output.strip().split('\n'):
        if not line: continue
        parts = line.split('|', 1)
        if len(parts) == 2:
            hash_val, subject = parts
            if subject.startswith("Done V2."):
                ver = subject.split(" - ")[0].replace("Done V2.", "")
                commits_by_version[ver] = hash_val

    for commit in commits:
        ver = commit['version']
        hash_val = commits_by_version.get(ver)
        if not hash_val:
            print(f"ERROR: Could not find commit hash for V2.{ver}")
            continue
            
        print(f"Checking out V2.{ver} ({hash_val})...")
        run_cmd(f"git checkout {hash_val}")
        
        target_dir = os.path.join(UPDATES_DIR, ver)
        os.makedirs(target_dir, exist_ok=True)
        
        # Copy directory excluding .git, node_modules, apply_commits.py
        def ignore_patterns(path, names):
            return ['.git', 'node_modules', 'apply_commits.py', 'temp_commit_msg.txt']
            
        print(f"Copying to {target_dir}...")
        # Since target_dir might already exist, shutil.copytree needs dirs_exist_ok=True (Python 3.8+)
        shutil.copytree(TEST_REPO, target_dir, ignore=ignore_patterns, dirs_exist_ok=True)
        
        # Write commit.txt
        original_msg = f"{commit['title']}\n\n{commit['message']}"
        with open(os.path.join(target_dir, "commit.txt"), "w", encoding="utf-8") as f:
            f.write(original_msg)
            
    # 9. Restore and cleanup
    run_cmd("git checkout main")
    print("Done!")

if __name__ == "__main__":
    main()
