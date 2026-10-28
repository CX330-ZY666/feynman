# 费曼学习平台 Spring Boot 后端

## 本地环境

- JDK 21
- MySQL 8
- 数据库：`feynman_platform`
- 数据库账号：`feynman_app`

## 启动前配置

不要把密码写入 Git。请在 PowerShell 中设置当前终端的环境变量：

```powershell
$env:DB_PASSWORD='你的数据库密码'
```

## 启动

Maven Wrapper 加入后执行：

```powershell
.\mvnw.cmd spring-boot:run
```

健康检查地址：`http://localhost:8080/api/health`
