FROM node:22-alpine
RUN apk add ffmpeg
RUN mkdir -p tidstangsel/assets tidstangsel/dist
COPY package.json /tidstangsel/package.json
COPY /dist/client.js /tidstangsel/dist/client.js
COPY /src/server/server.js /tidstangsel/server.js
COPY /src/server/RemoteAudioFileStreamer.js /tidstangsel/RemoteAudioFileStreamer.js
COPY /src/server/server_utils.js /tidstangsel/server_utils.js
COPY /assets /tidstangsel/assets
WORKDIR tidstangsel
RUN npm install

CMD npm run start_server_prod
