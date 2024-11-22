FROM node:22-alpine
RUN apk add ffmpeg
RUN mkdir -p tidsstangsel/assets tidsstangsel/dist
COPY package.json /tidsstangsel/package.json
COPY /dist/client.js /tidsstangsel/dist/client.js
COPY /src/server/server.js /tidsstangsel/server.js
COPY /src/server/RemoteAudioFileStreamer.js /tidsstangsel/RemoteAudioFileStreamer.js
COPY /src/server/server_utils.js /tidsstangsel/server.js
COPY /assets /tidsstangsel/assets
EXPOSE 8080
WORKDIR tidsstangsel
RUN npm install

CMD npm run start_server_prod
