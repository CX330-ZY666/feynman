# --- 简单粗暴版 Start ---
$OutputFile = "GEMINI.md"

# 写入标题
$Content = "# Project Context`nThis is a list of all files in the project.`n`n## File List`n"

Write-Host "Scanning..." -ForegroundColor Green

# 直接获取所有文件，排除掉垃圾目录
# -Depth 5 意味着最多往里查 5 层，防止太深
Get-ChildItem -Recurse -Depth 5 | Where-Object {
    $_.FullName -notmatch "node_modules" -and 
    $_.FullName -notmatch "\.git" -and 
    $_.FullName -notmatch "__pycache__" -and 
    $_.FullName -notmatch "venv" -and
    $_.FullName -notmatch "dist" -and
    $_.FullName -notmatch ".vscode"
} | ForEach-Object {
    # 把长长的绝对路径变成短的相对路径
    $ShortPath = $_.FullName.Replace($PWD.Path, "")
    $Content += "$ShortPath`n"
}

# 写入文件
Set-Content -Path $OutputFile -Value $Content -Encoding UTF8

Write-Host "Done! Check GEMINI.md now." -ForegroundColor Cyan
# --- 简单粗暴版 End ---