//const serverEvents = require("./server_events");
const wavdecode = require("./wav-decoder.js");
const https = require("https");

var pcmformat = {
  signed: true,
  float: true,
  bitDepth: 32,
  byteOrder: "LE",
  channels: 1,
  sampleRate: 44100,
  interleaved: false,
  samplesPerFrame: 1024,
  id: "S_16_LE_2_44100_I",
  max: 1,
  min: -1,
};

function parseWavHeader(data, chunkDur) {
  let fmt = data.toString("ascii", 8, 12);
  if (fmt !== "WAVE") {
    throw "the file is not a wav file";
  }
  const rifftag = data.toString("ascii", 0, 4);
  const wavetag = data.toString("ascii", 8, 12);
  const datatag = data.toString("ascii", 36, 40);
  const channels = data.readUInt16LE(22); // Number of channels
  const sampleRate = data.readUInt32LE(24); // Sample Rate
  const bytesPerSec = data.readUInt32LE(28); // Not a fixed value if the audio data is compressed, will only work for uncompressed file formats
  const bytesPerSample = data.readUInt16LE(32); // Bytes per sample = (bitdepth / 8) * number of channels
  const bitsPerSample = data.readUInt16LE(34); // Bits per sample = bit depth
  const orgDatasize = data.readUIntLE(72, 4); // Original data size of the file
  const chunkSize = bytesPerSec * chunkDur;
  const padSize = chunkSize - (orgDatasize % chunkSize);
  const dataSize = orgDatasize + padSize;
  const duration = dataSize / bytesPerSec;
  const totalChunks = dataSize / chunkSize;
  const playBufSize = bytesPerSec;
  return {
    startIndex: 258,
    orgDatasize: orgDatasize,
    rifftag: rifftag,
    wavetag: wavetag,
    datatag: datatag,
    channels: channels,
    sampleRate: sampleRate,
    bytesPerSec: bytesPerSec,
    bytesPerSample: bytesPerSample,
    bitDepth: bitsPerSample,
    dataSize: dataSize,
    chunkSize: chunkSize,
    padSize: padSize,
    chunkDur: chunkDur,
    duration: duration,
    totalChunks: totalChunks,
    playBufSize: playBufSize,
  };
}

async function remoteRangeRequest(url, start, end) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
      headers: {
        Range: `bytes=${start}-${end}`, // Use the dynamic range
      },
    };

    https
      .get(options, (res) => {
        if (res.statusCode === 206) {
          let data = [];
          res.on("data", (chunk) => {
            data.push(chunk);
            //console.log(chunk);
          });
          res.on("end", () => {
            let buffer = Buffer.concat(data);
            //console.log("data array output", data);
            //const buffer = Buffer.concat(data);
            //console.log("buffer concat output:", buffer); //here I dont see zeroes....
            resolve(buffer); // Resolve the promise with the Buffer
          });
        } else {
          reject(
            new Error(
              `Failed to fetch partial content, status: ${res.statusCode}`,
            ),
          );
        }
      })
      .on("error", (err) => {
        reject(err); // Handle network errors
      });
  });
}

async function getRemoteWavInfo(url, chunkDur) {
  try {
    // Fetch the first 10 KB of the WAV file for parsing the header
    let headerbuffer = await remoteRangeRequest(url, 0, 128);
    return parseWavHeader(headerbuffer, chunkDur);
  } catch (err) {
    console.error("Error fetching WAV file:", err);
  }
}

async function downloadRemoteFile(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname,
    };

    let req = https
      .get(options, (res) => {
        if (res.statusCode === 200) {
          let data = [];
          let downloadedSize = 0;
          res.on("data", (chunk) => {
            data.push(chunk);
            downloadedSize += chunk.length;
            //console.log(downloadedSize);
          });
          res.on("end", () => {
            const buffer = Buffer.concat(data);
            resolve(buffer); // Resolve the promise with the Buffer
          });
        } else {
          reject(new Error(`Failed ${res.statusCode}`));
        }
      })
      .on("error", (err) => {
        reject(err); // Handle network errors
      });
  });
}

class RemotePcmRange {
  constructor(url, infoObj) {
    this.url = url;
    console.log(this.url);
    this.info = infoObj;
    this.ready = false;
    this.audioBuffer = null;
  }

  async startDownload() {
    if (!this.ready) {
      console.log("starting download!");
      let buf = await remoteRangeRequest(
        this.url,
        0,
        this.info.chunkSize * this.info.totalChunks,
      );
      this.audioBuffer = await wavdecode.decode(buf);
      console.log(this.audioBuffer.channelData[0]);
      //serverEvents.emit("pcm_download_finished");
      this.ready = true;
    }
  }

  getFormat() {
    return this.format;
  }

  getChunk(n) {
    if (this.ready) {
      //console.log("get Chunk Called!");
      let cursor = n % this.info.totalChunks;
      let si = n > 0 ? this.info.sampleRate * (cursor - 1) : 0;
      let ei = si + this.info.sampleRate;
      let c = this.audioBuffer.channelData[0].slice(si, ei);
      //console.log(c);
      return c;
    }
  }

  isReady() {
    return this.ready;
  }
}

class RemotePcmAll {
  constructor(url, infoObj) {
    this.url = url;
    this.info = infoObj;
    this.ready = false;
    this.buffer = null;
    this.format = null;
  }

  async startDownload() {
    if (!this.ready) {
      console.log("starting stream!");
      this.buffer = await dowloadRemoteFile(this.url);
      this.audioBuffer = await wavdecode.decode(buf);
      console.log(this.audioBuffer.channelData[0]);
      //serverEvents.emit("pcm_download_finished");
      this.ready = true;
    }
  }

  getFormat() {
    if (this.ready) {
      return this.format;
    }
  }

  getChunk(n) {
    if (this.ready) {
      //console.log("get Chunk Called!");
      let cursor = n % this.info.totalChunks;
      let si = n > 0 ? this.info.chunkSize * (n - 1) : 0;
      let ei = si + this.info.chunkSize;
      return this.buffer.slice(si, ei);
    }
  }

  isReady() {
    return this.ready;
  }
}

module.exports.RemotePcmRange = RemotePcmRange;
module.exports.RemotePcmAll = RemotePcmAll;
module.exports.remoteRangeRequest = remoteRangeRequest;
module.exports.downloadRemoteFile = downloadRemoteFile;
module.exports.getRemoteWavInfo = getRemoteWavInfo;
module.exports.parseWavHeader = parseWavHeader;
