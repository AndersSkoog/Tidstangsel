FROM node:22-alpine
EXPOSE 3000
RUN npm install -g bun
RUN mkdir -p /tidstangsel/assets tidstangsel/dist
COPY assets/ /tidstangsel/assets/
COPY dist/  /tidstangsel/dist/
COPY server.js /tidstangsel/server.js
COPY server_remotefile.js /tidstangsel/server_remotefile.js
COPY server_events.js /tidstangsel/server_events.js
COPY server_session.js /tidstangsel/server_session.js
COPY wav-decoder.js /tidstangsel/wav-decoder.js
WORKDIR tidstangsel
CMD NODE_ENV=production bun run server.js
