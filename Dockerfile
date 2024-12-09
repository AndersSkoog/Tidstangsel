FROM node:22-alpine
EXPOSE 9000
RUN mkdir tidstangsel
COPY package.json /tidstangsel/package.json
COPY /dist/client.js /tidstangsel/client.js
COPY server.js /tidstangsel/server.js
COPY server_broadcastfile.js /tidstangsel/server_broadcastfile.js
COPY server_events.js /tidstangsel/server_events.js
COPY server_utils.js /tidstangsel/server_utils.js
COPY /assets /tidstangsel/assets
WORKDIR tidstangsel
RUN npm install
CMD npm run start_server_prod
