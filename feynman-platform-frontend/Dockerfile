# --- 构建阶段 --- 
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install
COPY . .
# 执行打包命令
RUN npm run build

# --- 生产阶段 ---
FROM nginx:stable-alpine

# 从构建阶段复制打包好的静态文件到 Nginx 的默认Web根目录
COPY --from=builder /app/dist /usr/share/nginx/html

# （可选）如果需要自定义Nginx配置，可以取消下面这行注释
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露Nginx的默认端口
EXPOSE 80

# 启动Nginx服务
CMD ["nginx", "-g", "daemon off;"]
