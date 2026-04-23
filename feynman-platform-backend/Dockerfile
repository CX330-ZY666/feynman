# 使用官方的 Node.js 18 镜像作为基础
FROM node:18-alpine

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖 (在生产环境中建议使用 npm ci)
RUN npm install

# 复制所有项目文件
COPY . .

# 暴露后端服务端口
EXPOSE 3000

# 启动命令
CMD [ "node", "index.js" ]
