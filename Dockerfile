FROM node:22-alpine
EXPOSE 3000
RUN npm install -g bun
RUN apk update && apk add --no-cache ffmpeg
RUN mkdir -p /tidstangsel/assets tidstangsel/hls
COPY assets/ /tidstangsel/assets/
COPY client_bundle.js /tidstangsel/client_bundle.js
COPY server_new.js /tidstangsel/server_new.js
WORKDIR tidstangsel
CMD NODE_ENV=production bun server_new.js
