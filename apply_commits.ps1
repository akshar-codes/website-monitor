$ErrorActionPreference = "Stop"
$sourceDir = "D:\Programming\Major Projects\Website Monitor\files"
$repoDir = "D:\Programming\Major Projects\Website Monitor\Test"
$snapshotBaseDir = "D:\Programming\Major Projects\Website Monitor\Updates\V2"

$fileMappings = @{
    "backend/src/config/activityConstants.js" = "activityConstants.js"
    "backend/src/models/Activity.js" = "Activity.js"
    "backend/src/utils/activityLogger.js" = "activityLogger.js"
    "backend/src/validators/activity.validator.js" = "activity.validator.js"
    "backend/src/services/activity.service.js" = "activity.service.js"
    "backend/src/controllers/activity.controller.js" = "activity.controller.js"
    "backend/src/routes/activity.routes.js" = "activity.routes.js"
    "backend/src/routes/index.js" = "index.js"
    "backend/src/config/permissions.js" = "permissions.js"
    "backend/src/controllers/auth.controller.js" = "auth.controller.js"
    "backend/src/services/profile.service.js" = "profile.service.js"
    "backend/src/services/preference.service.js" = "preference.service.js"
    "backend/src/services/monitor.service.js" = "monitor.service.js"
    "backend/src/services/incident.service.js" = "incident.service.js"
    "backend/src/services/plan.service.js" = "plan.service.js"
    "backend/src/services/admin.service.js" = "admin.service.js"
    "frontend/src/constants/activity.js" = "activity (2).js"
    "frontend/src/services/api/activity.js" = "mnt\user-data\outputs\frontend\src\services\api\activity.js"
    "frontend/src/hooks/useActivity.js" = "useActivity.js"
    "frontend/src/components/activity/ActivityIcon.jsx" = "ActivityIcon.jsx"
    "frontend/src/features/activity/ActivityFilters.jsx" = "ActivityFilters.jsx"
    "frontend/src/features/activity/ActivityTimeline.jsx" = "ActivityTimeline.jsx"
    "frontend/src/features/activity/RecentActivitySummary.jsx" = "RecentActivitySummary.jsx"
    "frontend/src/pages/Activity.jsx" = "Activity.jsx"
    "frontend/src/constants/routes.js" = "routes.js"
    "frontend/src/App.jsx" = "App.jsx"
    "frontend/src/components/layout/Sidebar.jsx" = "Sidebar.jsx"
}

$commits = @(
    @{
        Id = "130"
        GitMessage = "Done V2.130 - feat(activity): add activity logging foundation`n`n- Add activity model with optimized indexes`n- Define reusable activity constants`n- Create centralized activity logging utility`n- Prepare scalable activity tracking architecture"
        CommitText = "feat(activity): add activity logging foundation`n`n- Add activity model with optimized indexes`n- Define reusable activity constants`n- Create centralized activity logging utility`n- Prepare scalable activity tracking architecture`n`nFiles`n`nbackend/src/config/activityConstants.js`nbackend/src/models/Activity.js`nbackend/src/utils/activityLogger.js"
        Files = @("backend/src/config/activityConstants.js", "backend/src/models/Activity.js", "backend/src/utils/activityLogger.js")
    },
    @{
        Id = "131"
        GitMessage = "Done V2.131 - feat(activity): implement activity management APIs`n`n- Add activity validation and service layer`n- Implement activity controllers`n- Support filtering, searching and pagination`n- Add recent activity summary endpoints"
        CommitText = "feat(activity): implement activity management APIs`n`n- Add activity validation and service layer`n- Implement activity controllers`n- Support filtering, searching and pagination`n- Add recent activity summary endpoints`n`nFiles`n`nbackend/src/validators/activity.validator.js`nbackend/src/services/activity.service.js`nbackend/src/controllers/activity.controller.js"
        Files = @("backend/src/validators/activity.validator.js", "backend/src/services/activity.service.js", "backend/src/controllers/activity.controller.js")
    },
    @{
        Id = "132"
        GitMessage = "Done V2.132 - feat(activity): register activity module`n`n- Add activity API routes`n- Register activity endpoints`n- Extend application permissions`n- Integrate activity module into routing"
        CommitText = "feat(activity): register activity module`n`n- Add activity API routes`n- Register activity endpoints`n- Extend application permissions`n- Integrate activity module into routing`n`nFiles`n`nbackend/src/routes/activity.routes.js`nbackend/src/routes/index.js`nbackend/src/config/permissions.js"
        Files = @("backend/src/routes/activity.routes.js", "backend/src/routes/index.js", "backend/src/config/permissions.js")
    },
    @{
        Id = "133"
        GitMessage = "Done V2.133 - feat(activity): track authentication and profile events`n`n- Log authentication activities`n- Record profile updates`n- Track preference changes`n- Reuse centralized activity logger"
        CommitText = "feat(activity): track authentication and profile events`n`n- Log authentication activities`n- Record profile updates`n- Track preference changes`n- Reuse centralized activity logger`n`nFiles`n`nbackend/src/controllers/auth.controller.js`nbackend/src/services/profile.service.js`nbackend/src/services/preference.service.js"
        Files = @("backend/src/controllers/auth.controller.js", "backend/src/services/profile.service.js", "backend/src/services/preference.service.js")
    },
    @{
        Id = "134"
        GitMessage = "Done V2.134 - feat(activity): log application resource events`n`n- Track monitor lifecycle activities`n- Record incident management actions`n- Log plan management operations`n- Improve user activity visibility"
        CommitText = "feat(activity): log application resource events`n`n- Track monitor lifecycle activities`n- Record incident management actions`n- Log plan management operations`n- Improve user activity visibility`n`nFiles`n`nbackend/src/services/monitor.service.js`nbackend/src/services/incident.service.js`nbackend/src/services/plan.service.js"
        Files = @("backend/src/services/monitor.service.js", "backend/src/services/incident.service.js", "backend/src/services/plan.service.js")
    },
    @{
        Id = "135"
        GitMessage = "Done V2.135 - feat(activity): log administrative actions`n`n- Track administrative user operations`n- Record role and plan changes`n- Capture moderation activities`n- Complete backend activity integration"
        CommitText = "feat(activity): log administrative actions`n`n- Track administrative user operations`n- Record role and plan changes`n- Capture moderation activities`n- Complete backend activity integration`n`nFiles`n`nbackend/src/services/admin.service.js"
        Files = @("backend/src/services/admin.service.js")
    },
    @{
        Id = "136"
        GitMessage = "Done V2.136 - feat(activity): add frontend activity data layer`n`n- Add activity API client`n- Implement reusable activity hooks`n- Define shared activity constants`n- Prepare frontend activity management"
        CommitText = "feat(activity): add frontend activity data layer`n`n- Add activity API client`n- Implement reusable activity hooks`n- Define shared activity constants`n- Prepare frontend activity management`n`nFiles`n`nfrontend/src/constants/activity.js`nfrontend/src/services/api/activity.js`nfrontend/src/hooks/useActivity.js"
        Files = @("frontend/src/constants/activity.js", "frontend/src/services/api/activity.js", "frontend/src/hooks/useActivity.js")
    },
    @{
        Id = "137"
        GitMessage = "Done V2.137 - feat(activity): build reusable activity components`n`n- Add activity icon mapping`n- Create filtering interface`n- Build timeline component`n- Add recent activity summary"
        CommitText = "feat(activity): build reusable activity components`n`n- Add activity icon mapping`n- Create filtering interface`n- Build timeline component`n- Add recent activity summary`n`nFiles`n`nfrontend/src/components/activity/ActivityIcon.jsx`nfrontend/src/features/activity/ActivityFilters.jsx`nfrontend/src/features/activity/ActivityTimeline.jsx`nfrontend/src/features/activity/RecentActivitySummary.jsx"
        Files = @("frontend/src/components/activity/ActivityIcon.jsx", "frontend/src/features/activity/ActivityFilters.jsx", "frontend/src/features/activity/ActivityTimeline.jsx", "frontend/src/features/activity/RecentActivitySummary.jsx")
    },
    @{
        Id = "138"
        GitMessage = "Done V2.138 - feat(activity): integrate activity history into the application`n`n- Add complete activity history page`n- Register activity route`n- Add sidebar navigation entry`n- Complete end-to-end activity experience"
        CommitText = "feat(activity): integrate activity history into the application`n`n- Add complete activity history page`n- Register activity route`n- Add sidebar navigation entry`n- Complete end-to-end activity experience`n`nFiles`n`nfrontend/src/pages/Activity.jsx`nfrontend/src/constants/routes.js`nfrontend/src/App.jsx`nfrontend/src/components/layout/Sidebar.jsx"
        Files = @("frontend/src/pages/Activity.jsx", "frontend/src/constants/routes.js", "frontend/src/App.jsx", "frontend/src/components/layout/Sidebar.jsx")
    }
)

Set-Location -Path $repoDir

$commitHashes = @()

foreach ($commit in $commits) {
    $hasPackageJson = $false
    
    foreach ($file in $commit.Files) {
        $sourceRelativePath = $fileMappings[$file]
        $srcPath = Join-Path $sourceDir $sourceRelativePath
        $destPath = Join-Path $repoDir $file
        
        $destDir = Split-Path $destPath -Parent
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        
        Copy-Item -Path $srcPath -Destination $destPath -Force
        
        if ($file.EndsWith("package.json", [System.StringComparison]::InvariantCultureIgnoreCase)) {
            $hasPackageJson = $true
            $packageJsonDir = $destDir
        }
    }
    
    if ($hasPackageJson) {
        Write-Host "Running npm install in $packageJsonDir..."
        $currentLoc = Get-Location
        Set-Location $packageJsonDir
        npm install
        Set-Location $currentLoc
    }
    
    git add .
    
    $msgFile = Join-Path $repoDir "temp_msg.txt"
    [IO.File]::WriteAllText($msgFile, $commit.GitMessage, (New-Object System.Text.UTF8Encoding $false))
    git commit -F $msgFile
    Remove-Item $msgFile
    
    $hash = git rev-parse HEAD
    $commitHashes += [PSCustomObject]@{
        Hash = $hash.Trim()
        Id = $commit.Id
        CommitText = $commit.CommitText
    }
}

foreach ($c in $commitHashes) {
    git checkout $c.Hash
    
    $snapDir = Join-Path $snapshotBaseDir $c.Id
    if (-not (Test-Path $snapDir)) {
        New-Item -ItemType Directory -Path $snapDir -Force | Out-Null
    }
    
    $excludeDirs = @(".git", "node_modules")
    $excludeFiles = @("apply_commits.ps1")
    
    $rc = robocopy $repoDir $snapDir /E /XD $excludeDirs /XF $excludeFiles /R:0 /W:0 /NJH /NJS /NDL /NC /NS /NP
    
    $commitTxtPath = Join-Path $snapDir "commit.txt"
    [IO.File]::WriteAllText($commitTxtPath, $c.CommitText, (New-Object System.Text.UTF8Encoding $false))
}

git checkout main
Remove-Item -Path (Join-Path $repoDir "apply_commits.ps1") -Force
Write-Host "Done!"
