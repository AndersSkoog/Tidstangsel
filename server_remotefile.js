const {serverEvents} = require("./server_events.js");
const wavdecode = require("./wav-decoder.js");
const https = require("https");

const pcmformat = {
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
		playBufSize: playBufSize
	};
}

async function downloadRemoteFile(url) {
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
						infoObj = parseWavHeader(chunk,1);
						data.push(chunk);	
					}
					else {
						data.push(chunk);
						downloadedSize += chunk.length;
						console.log("bytes downloaded:",downloadedSize);
					}
				});
				res.on("end", () => {
					//wav-decoder expects arrayBuffer https://bun.sh/guides/binary/buffer-to-arraybuffer
					let ret = {info:infoObj,buffer:Buffer.concat(data).buffer};
					resolve(ret); // Resolve the promise with the Buffer, and Info obj
				});
			} 
			else {reject(new Error(`Failed ${res.statusCode}`));}
		}).on("error", (err) => {reject(err); }); // Handle network errors
	});
}

class RemotePcmAll {
	constructor(url) {
		this.url = url;
		this.info = null;
		this.ready = false;
		this.audioBuffer = null;
		this.format = null;
	}

	startDownload() {
		if (!this.ready) {
			console.log("starting download!");
			downloadRemoteFile(this.url).then((resp)=> {
				let info = resp.info;
				wavdecode.decode(resp.buffer).then((buf)=> {
					console.log(buf);
					this.info = info;
					this.audioBuffer = buf;
					this.ready = true;
					console.log("download finished");
					serverEvents.emit("pcm_download_finished",this.info);
				}).catch((error)=> {
					console.log("download failed");
					serverEvents.emit("pcm_download_failed",error);
				});
			}).catch((error)=> {
				console.log("download failed");
				serverEvents.emit("pcm_download_failed",error);
			});
		}
	}

	getInfo() {
		if (this.ready) {
			return this.info;
		}
		else {
			return null;
		}
	}

	getChunk(n) {
		if (this.ready) {
			//console.log("get Chunk Called!");
			//console.log("audioBuffer:", this.audioBuffer);
			//console.log("audioBuffer chunk", this.audioBuffer.channelData[0].subarray(0,this.info.chunkSize));
			let cursor = n % this.info.totalChunks;
			let si = n > 0 ? this.info.chunkSize * (n - 1) : 0;
			let ei = si + this.info.chunkSize;
			return this.audioBuffer.channelData[0].subarray(si, ei);
		}
		else {
			return null;
		}
	}

	isReady() {
		return this.ready;
	}
}

module.exports.RemotePcmAll = RemotePcmAll;