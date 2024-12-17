/*
This file is responsible for managing a websocket connection where the audio data from the stream is being sent.
It also manage the playback of the audio data using the WebAudio API.  
*/
import { globals } from "./client_globals";
let socket = null;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
	sampleRate: 44100,
});
const gainNode = audioCtx.createGain(); // create a gain node which we use to control the volume of the stream
//const playBtn     = document.querySelector("#playStreamBtn"); //
let streamQueue: AudioBuffer[] = []; //this is the queue of AudioBuffers where each buffer is contains exactly one second of audio data or 44100 samples.
let isPlaying: boolean = false; //state used by the queue and playback mechanism
let sr: number = 44100; //the samplerate of the stream. change this if you will be downloading another file than the one specified in the AUIO_URL variable in the .env file.
let fadeTime: number = 4000; //time in miliseconds which for the duraton of the volume fadein/fadeout effect.
gainNode.connect(audioCtx.destination);
//see reference:
//  https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode
//  https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
async function playNextInQueue() {
	if (streamQueue.length > 0) {
		console.log("playing next in queue!");
		let buffer = streamQueue.shift(); //.shift() removes the first buffer from the queue and returns it.
		let source = audioCtx.createBufferSource();
		source.buffer = buffer; //set the buffer of the buferSource
		//console.log("playbuffer",source.buffer.getChannelData(0));
		source.connect(gainNode);
		source.onended = () => {
			//isPlaying = false;
			//console.log("chunk ended!");
			source.disconnect();
			source = null;
			buffer = null;
			playNextInQueue();
		};
		// Schedule the playback to ensure gapless audio
		source.start(); // Start immediately, adjusting timing
		isPlaying = true; // Set the flag to indicate we're currently playing
	} else {
		isPlaying = false;
	}
}
async function addPcmToQueue(pcmdata) {
	console.log("adding to queue!");
	//console.log(pcmdata.length);
	//console.log(pcmdata);
	let buf = audioCtx.createBuffer(1, pcmdata.length, sr);
	buf.copyToChannel(pcmdata, 0);
	streamQueue.push(buf);
	if (!isPlaying && streamQueue.length >= 4) {
		console.log("gainNode volume:", gainNode.volume);
		fadeIn();
		playNextInQueue();
		//isPlaying = true;
	}
}
async function fadeIn() {
	gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
	gainNode.gain.linearRampToValueAtTime(
		1,
		audioCtx.currentTime + fadeTime / 1000,
	);
}
async function fadeOut() {
	gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
	gainNode.gain.linearRampToValueAtTime(
		0,
		audioCtx.currentTime + fadeTime / 1000,
	);
}
async function openStream() {
	if (!socket) {
		console.log("opening stream!");
		/*
            the socket_nonce variable holds the uuid value set by the server when loading the page. 
            this uuid is used for authenticating that a websocket connection request originates from our client code. 
            each nonce can only be used once. if the client disconnects from the socket, 
            you will have to refresh the page in order to listen to the stream again. 
        */
		let conn_str = `ws://${window.location.hostname}:3000/tidstangsel/stream?nonce=${globals.socket_nonce}`;
		console.log("conn_str:", conn_str);
		socket = new WebSocket(conn_str);
		socket.onopen = async () => {
			console.log("WebSocket connection established");
		};
		socket.onmessage = async (event) => {
			if (event.data instanceof Blob) {
				console.log("audio chunk received!");
				const arrayBuffer = await event.data.arrayBuffer();
				const pcmdata = new Float32Array(arrayBuffer);
				//console.log(pcmdata);
				addPcmToQueue(pcmdata);
			}
			if (typeof event.data === "string") {
				console.log(event.data);
				if (event.data.message === "init_stream") {
					sr = parseInt(event.data.sampleRate);
					alert("Buffrar Verner Bostöms Poesi, ljudstöm börjar om 10 sekunder");
				}
			}
		};
		socket.onerror = async (error) => {
			console.log("WebSocket error:", error);
		};

		socket.onclose = async () => {
			console.log("WebSocket connection closed");
		};
	}
}
async function closeStream() {
	if (socket !== null) {
		fadeOut();
		setTimeout(() => {
			console.log("socket is closing!");
			socket.close(1000, "closed by application logic");
			socket = null;
			isPlaying = false;
			streamQueue = [];
			//audioCtx.suspend();
		}, fadeTime);
	}
}
async function killStream() {
	if (socket !== null) {
		console.log("socket killed!");
		socket.close(1000, "closed by application logic");
		socket = null;
		isPlaying = false;
		streamQueue = [];
		//audioCtx.suspend();
	}
}
export { openStream, closeStream, killStream };
