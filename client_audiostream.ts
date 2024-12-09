import {WebSocket} from "ws";
const connect_str = "ws://"+window.location.hostname+":9000/stream";
let socket      : WebSocket | null = null;
let audioCtx    : AudioContext | webkitAudioContext | null = null; //new (window.AudioContext || window.webkitAudioContext)();
let gainNode    : GainNode | null = null;
let streamQueue : AudioBuffer[] = [];
let isPlaying   : boolean = false;
let sr 			: number | null = null;
let fadeTime    : number = 4000;


function playNextInQueue() {
    if (streamQueue.length > 0) {
        let buffer = playbackQueue.shift(); // Get the next buffer from the queue
        let source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(gainNode);
        source.onended = () => {
        	//isPlaying = false;
        	source.disconnect();
        	source = null;
        	buffer = null;
            playNextInQueue();
        };

        // Schedule the playback to ensure gapless audio
        source.start(audioContext.currentTime); // Start immediately, adjusting timing
        isPlaying = true; // Set the flag to indicate we're currently playing
    }
    else {
    	isPlaying = false;
    }
}

function addPcmToQueue(pcmdata){
	let buf = audioCtx.createBuffer(1,sr);
	buf.copyToChannel(pcmdata,0);
	streamQueue.push(buf);
}


function fadeIn() {
    gainNode?.gain.setValueAtTime(0,audioCtx?.currentTime);
    gainNode?.gain.linearRampToValueAtTime(1,audioCtx?.currentTime + fadeTime / 1000);
}
    
function fadeOut() {
    gainNode?.gain.setValueAtTime(gainNode?.gain.value,audioCtx?.currentTime);
    gainNode?.gain.linearRampToValueAtTime(0,audioCtx?.currentTime + fadeTime / 1000);
}


function openStream(){
	if(!socket){
		socket = new WebSocket(conncect_str);
		socket.addEventListener('open', () => {
    		console.log('WebSocket connection established');
		});

		socket.addEventListener('message', (event) => {
    		if(event.data instanceof ArrayBuffer){
    			let pcmdata = new Float32Array(event.data.buffer);
    			addPcmToQueue(pcmdata);
    			if(!isPlaying && streamQueue.length >= 4){
    				fadeIn();
    				playNextInQueue();
    			}
    		}
    		if(typeof(event.data) === "string"){
    			const message = JSON.parse(event.data);
        		if (message.type === 'init') {
            		audioCtx  = new (window.AudioContext || window.webkitAudioContext)({sampleRate:message.sampleRate});
            		gainNode = audioCtx.createGain();
            		gainNode.connect(audioCtx.destination);
            		sr = message.sampleRate;
        		}
    		}
		});

		socket.addEventListener('error', (error) => {
    		console.log('WebSocket error:', error);
		});
		
		socket.addEventListener('close', () => {
    		console.log('WebSocket connection closed');
		});
	}

}

function closeStream(){
  	if(socket !== null){
  		fadeOut();
  		setTimeout(() => {
  			socket.close(1000,"closed by application logic");
  			audioCtx.close();
  			socket = null;
  			audioCtx = null;
  			gainNode = null;
  			isPlaying = false;
  			streamQueue = [];
    	},fadeTime);
	}
}

function killStream(){
  	if(socket !== null){
  		//fadeOut();
  		//setTimeout(() => {
  		socket.close(1000,"closed by application logic");
  		audioCtx.close();
  		socket = null;
  		audioCtx = null;
  		gainNode = null;
  		isPlaying = false;
  		streamQueue = [];
	}
}

export {openStream, closeStream, killStream}

