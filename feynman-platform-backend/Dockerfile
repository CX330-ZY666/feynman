# 使用官方的 Node.js 20 镜像作为基础
FROM node:20-alpine

# 安装 node-gyp 编译所需的构建工具 (hnswlib-node 需要)
RUN apk add --no-cache python3 make g++

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
