# GitHub 自动部署到 Windows 云服务器

当前仓库：`CX330-ZY666/feynman`，部署分支：`main`。

流程：本地修改并推送 → GitHub Actions 构建 React、测试并打包 Java → SSH 上传发布包 → 服务器备份旧文件、重启后端、检查健康接口 → 发布前端。

构建在 GitHub 执行，不占用生产服务器内存。工作流不会在 PR 上部署；只有推送 main 和手动触发才会运行。能向 main 推送代码的人具有部署权限，请勿向不可信协作者开放此权限。

## 0. 第一次部署前

- 服务器已有 `C:\apps\feynman\dist`、后端 JAR、`start-backend.ps1` 和名为 `Feynman Backend` 的计划任务。
- 启动脚本中的密码、JWT、DeepSeek 和百度密钥只保留在服务器，脚本已加入 `--server.forward-headers-strategy=framework`。
- 模型保留在 `C:\apps\feynman\models`，不上传 GitHub。
- 本次账号功能增加 V4 数据库迁移。先备份 MySQL，再发布；启动时 Flyway 自动增加 auth_version 字段，不会清空旧数据。
- 旧版 MongoDB 的 vector_store 是本地数据，不能继续放在源码仓库中；即便取消跟踪，过去提交仍可能包含这些文件，不等于历史被清除。

在云服务器 PowerShell 先备份数据库（在提示处输入 MySQL root 密码，不会显示字符）：

```powershell
New-Item -ItemType Directory -Force C:\apps\feynman\backups | Out-Null
$backupFile = 'C:\apps\feynman\backups\mysql-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.sql'
& 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqldump.exe' -u root -p --single-transaction --routines --triggers --databases feynman_platform "--result-file=$backupFile"
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed. Do not deploy yet.' }
Get-Item $backupFile
```

## 1. 在自己的电脑生成专用部署密钥

在本地 PowerShell 执行（如果提示文件已存在，不要覆盖）：

```powershell
ssh-keygen -t ed25519 -C "feynman-github-deploy" -f "$env:USERPROFILE\.ssh\feynman_github"
```

两次询问 passphrase 时直接回车，这个专用密钥用于无人值守部署。生成两个文件：

- `feynman_github.pub`：公钥，复制到云服务器。
- `feynman_github`：私钥，只放在本地和 GitHub Secret，不要提交源码或发聊天。

## 2. 服务器只做一次 SSH 初始化

将以下文件复制到服务器：

- 本地 `deploy\windows\setup-ssh.ps1` → `C:\apps\feynman\setup-ssh.ps1`
- 本地 `deploy\windows\deploy-release.ps1` → `C:\apps\feynman\deploy-release.ps1`
- 本地 `feynman_github.pub` → `C:\apps\feynman\feynman_github.pub`

在服务器管理员 PowerShell 执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\apps\feynman\setup-ssh.ps1 -PublicKeyFile C:\apps\feynman\feynman_github.pub
```

脚本安装 OpenSSH Server、设置自动启动、配置管理员公钥并创建 incoming 目录。然后在腾讯云轻量服务器防火墙放行 TCP 22。密码登录远程桌面继续使用3389，不需要改动。

部署使用 Administrator，是为了操作现有管理员计划任务和项目目录。此专用私钥具有服务器管理权限，不能泄漏。后续可进一步迁移到权限受限的部署账号。

## 3. 从本地测试连接并记录服务器身份

在本地 PowerShell 执行：

```powershell
ssh -o HostKeyAlgorithms=ssh-ed25519 -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\feynman_github" Administrator@175.178.236.58 "whoami"
```

首次提示是否信任服务器时，将 SHA256 指纹与第2步服务器脚本打印的指纹比较。一致才输入 yes。成功会显示服务器上的 Administrator 用户。如果要求输入 Windows 密码，说明公钥登录没有成功，先排查，不能继续自动部署。

连接成功后，用记事本打开本地 `$env:USERPROFILE\.ssh\known_hosts`。找到以 `175.178.236.58 ssh-ed25519` 开头的那一整行，供下步填写。

## 4. GitHub 设置4个 Secrets

在仓库网页选择 Settings → Secrets and variables → Actions → New repository secret。

分别添加：

- `DEPLOY_HOST`：`175.178.236.58`
- `DEPLOY_USER`：`Administrator`
- `DEPLOY_SSH_KEY`：本地无 `.pub` 后缀的 `feynman_github` 文件的完整内容，包括 BEGIN / END 行。
- `DEPLOY_KNOWN_HOSTS`：第3步中已校验指纹的 known_hosts 整行。

不要把数据库密码、JWT、API 密钥放进前端的 VITE_* 变量。那些配置仍由服务器现有启动脚本管理。

## 5. 首次发布刚修改的代码

代码推送完成后，打开 GitHub → Actions → Build and deploy Feynman → Run workflow，选择 main。

如果尚未配置 Secrets，流程只构建并产生可下载的发布包，不会修改服务器。配置齐全后重新 Run workflow 才部署。

成功后检查：

- `https://www.zy6works.com/api/health` 返回 OK。
- 浏览器 Ctrl+F5，使用原账号登录，左下角显示昵称。
- 点击昵称进入账号设置，修改昵称。
- 用单独测试账号验证修改密码和注销；不要用正式数据测试注销。

后端启动超过两分钟或失败时，部署脚本尝试恢复旧 JAR 和前端。数据库迁移不会自动回滚；破坏性数据库改动不能依赖文件回退恢复。

## 6. 以后如何更新

在本地完成修改并测试后：

```powershell
git status
# 只添加本次需要发布的源码文件，禁止盲目 git add .
git add <本次修改的文件路径>
git commit -m "描述这次更新"
git push origin main
```

推送会自动构建并部署，不需要本地打包、手动复制 dist 或 JAR。观察 Actions 的结果，构建通过不代表服务器部署已经成功。

服务器备份放在 `C:\apps\feynman\backups`。每次包含旧 JAR 和前端，定期检查磁盘空间并手动保留最近几次；上传包和 incoming 中的解压目录也需定期清理。请只删除确认过的历史发布目录，不要删除根目录或模型目录。

## 7. 排错

- SSH 超时：检查服务器公网IP、腾讯云22端口、Windows防火墙和sshd服务。
- Permission denied (publickey)：检查公钥文件位置、ACL和连接用户名。
- 502：检查 `Feynman Backend` 任务、8080端口和 `logs\backend.log`。
- 403：核对启动脚本的 forward-headers 参数及 Nginx 的 X-Forwarded-Proto / Host 配置。
- GitHub 的 Maven 测试失败：不会上传发布包到服务器，先修复测试。

Nginx配置、证书、启动脚本不会被自动覆盖；今后如需变更这些部署脚本，需要单独审查并同步到服务器。
