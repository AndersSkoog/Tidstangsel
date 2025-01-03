const https = require("node:https");
//const {EventEmitter} = require("events");
const fs = require("node:fs");
const child_process = require("node:child_process");
//const serverEvents = new EventEmitter();
//const {isValidIP} = require("./server_session.js");
const production = Bun.env.NODE_ENV === "production";
const useCsp = Bun.env.USE_CSP === "true";
const audio_url = Bun.env.AUDIO_URL;
const host = Bun.env.HOST;
const port = Bun.env.PORT;
const ipv6Pattern =
  /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv4Pattern =
  /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
function isValidIP(str) {
  return ipv4Pattern.test(str) || ipv6Pattern.test(str);
}
const csp = [
"default-src 'self' https://tile.openstreetmap.org",
"img-src 'self' https://tile.openstreetmap.org data: blob:",
"connect-src 'self' wss: ws: https://tile.openstreetmap.org",
"style-src 'self' 'unsafe-inline'",
"media-src 'self' blob:",
"worker-src blob:",
"child-src blob:",
"script-src 'self'",
"object-src 'none'",
"frame-ancestors 'none'",
"form-action 'none'"
].join("; ");
const tidstangsel_headers = new Headers([
["Content-Type", "text/html"],
["X-Download-Options", "noopen"],
["X-XSS-Protection", "0"],
["Referrer-Policy", "same-origin"],
["X-Content-Type-Options", "nosniff"],
["X-Frame", "deny"],
["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
["Cross-Origin-Opener-Policy", "same-origin"],
["Cross-Origin-Embedder-Policy", "require-corp"],
["Content-Security-Policy", csp]]);
const tidstangsel_view = `<!doctype html>
<html lang="sv">
  <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <link rel="stylesheet" src="/maplibre-gl.css"/>
      <link rel="stylesheet" src="/style.css"/>
      <title>Tidsstängsel</title>
  </head>
  <body>
    <div id="appcontainer">
      <div id="map"></div>
    </div>
    <script src="/client.js"></script>
  </body>
</html>`;
const index_headers = new Headers([
["Content-Type", "text/html"],
["X-Download-Options", "noopen"],
["X-XSS-Protection", "0"],
["Referrer-Policy", "same-origin"],
["X-Content-Type-Options", "nosniff"],
["X-Frame", "deny"],
["Strict-Transport-Security", "max-age=63072000; includeSubDomains"],
["Cross-Origin-Opener-Policy", "same-origin"],
["Cross-Origin-Embedder-Policy", "require-corp"],
["Content-Security-Policy","default-src 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; script-src 'none';"]]);
const index_view = `<!doctype html>
<html lang="sv">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Landsvägsteater</title>
  </head>
  <body>
    <p>Välkommen till Landsvägsteater, ett nytt projekt skapat av <a href="https://institutet.eu">insitutet</a></p>
    <p>Informationen här kommer att uppdateras</p>
  </body>
</html>`;
let ffmpeg_process = null;
let is_running = false;
let retryAttempt = 5;
const file_url = production ? Bun.env.AUDIO_URL : Bun.env.AUDIO_TEST_URL;
const file_name = new URL(file_url).pathname.split("/").at(-1).split(".")[0];
const file_ext = new URL(file_url).pathname.split("/").at(-1).split(".")[1];
const file_path = "./"+file_name+"."+file_ext;
console.log(file_name);
console.log(file_path);
const ffmpegOpts = [
  "-re",
  "-stream_loop", "-1",
  "-i", file_path,
  "-f", "hls",
  "-hls_time", "1",          // Segment duration in seconds
  "-hls_list_size", "2",     // Number of segments in the playlist
  "-hls_segment_filename", "./hls/seg%03d.ts",
  "-hls_flags", "delete_segments", // Optional: remove old segments
  "./hls/stream.m3u8"
];

async function downloadRemoteFile(url,file_name) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname
    };
    let req = https.get(options, (res) => {
      if (res.statusCode === 200) {
        let data = [];
        let downloadedSize = 0;
        let infoObj = null;
        res.on("data", (chunk) => {
          if(downloadedSize === 0){
            downloadedSize += chunk.length;
            data.push(chunk); 
          }
          else {
            data.push(chunk);
            downloadedSize += chunk.length;
            console.log("bytes downloaded:",downloadedSize);
          }
        });
        res.on("end", () => {
          Bun.write(file_name+"."+file_ext,Buffer.concat(data)).then((result)=> {
            //serverEvents.emit("download_success",result);
            resolve(result);
          }).catch((error)=> reject(error));
        });
      } 
      else {
        //serverEvents.emit("download_failed");
        reject(new Error(`Failed ${res.statusCode}`));
      }
    }).on("error", (err) => {
      //serverEvents.emit("download_failed");
      reject(err); 
    }); // Handle network errors
  });
}

const server = Bun.serve({
  port: port,
  hostname: host,
  static: {
    "/verner_bostrom.png": new Response(await Bun.file("./assets/verner_bostrom.png").bytes(),{
        headers: {
          "Content-Type": "image/png",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
    "/static_map.png": new Response(await Bun.file("./assets/static_map.png").bytes(),{
        headers: {
          "Content-Type": "image/png",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
    "/style.css": new Response(await Bun.file("./assets/style.css").bytes(),{headers: {
        "Content-Type": "text/css",
        "X-Content-Type-Options": "nosniff",
      },
    }),
    "/w3.css": new Response(await Bun.file("./assets/w3.css").bytes(),{headers: {
        "Content-Type": "text/css",
        "X-Content-Type-Options": "nosniff",
      },
    }),
    "/maplibre-gl.css": new Response(await Bun.file("./assets/maplibre-gl.css").bytes(),{
        headers: {
          "Content-Type": "text/css",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
    "/client.js": new Response(await Bun.file("./client_bundle.js").bytes(),{
        headers: {
          "Content-Type": "text/javascript",
          "X-Content-Type-Options": "nosniff",
        },
      },
    ),
  },
  async fetch(req, server) {
    const url = new URL(req.url);
    const ip = req.headers.get("x-forwarded-for") || this.requestIP(req).address;
    const ip_valid = isValidIP(ip);
    const path = url.pathname;
    const tsMatch = path.match(/^\/tidstangsel\/(seg\d+)\.ts$/);
    //console.log("ip: ",ip,"ip_valid: ",ip_valid);
    const method = req.method;
    //only allow http get requests on our server
    if (method !== "GET" || !ip_valid) {
      return new Response("Forbidden", { status: 403 });
    } 
    else {
      if(path === "/tidstangsel"){
        return new Response(tidstangsel_view, { headers: tidstangsel_headers }); 
      }
      if(path === "/tidstangsel/stream.m3u8"){
        return new Response(await Bun.file("./hls/stream.m3u8").text(),{
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
            "Pragma": "no-cache", // For older HTTP/1.0 clients
            "Expires": "0", // Ensure it is treated as expired
          }
        });  
      }
      if (tsMatch) {
        const segmentName = tsMatch[1];
        const tsFilePath = `./hls/${segmentName}.ts`;
        try {
          const tsFile = await Bun.file(tsFilePath).bytes();
          return new Response(tsFile, {
            headers: {
              "Content-Type": "video/mp2t",
              "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
            },
          });
        } catch (error){
          console.log(error);
          return new Response("File Not Found", { status: 404 });
        }
      }
      return new Response("Not Found", { status: 404 });
    }
  }
});
fs.exists(file_path,(exists)=> {
  if(exists){
    ffmpeg_process = child_process.spawn("ffmpeg",ffmpegOpts);
    console.log("server is running on port:3000");
  }
  else {
    downloadRemoteFile(file_url,file_name).then((result)=> {
      console.log(result);
      ffmpeg_process = child_process.spawn("ffmpeg",ffmpegOpts);
      console.log("server is running on port:3000");
    });
  }
});