import {globals} from "./server_globals";
let socket        = null;
const audioCtx    = new (window.AudioContext || window.webkitAudioContext)({sampleRate:44100});
const gainNode    = audioCtx.createGain();
const playBtn     = document.querySelector("#playStreamBtn");
console.log(playBtn);
let streamQueue   : AudioBuffer[] = [];
let isPlaying     : boolean = false;
let sr 			  : number = 44100;
let fadeTime      : number = 4000;
let nonce = document.querySelector("#client_script_tag").dataset.nonce;
console.log(nonce);

gainNode.connect(audioCtx.destination);
playBtn.addEventListener("click",()=> {
    if(isPlaying){
        playBtn.textContent = "pausa ljudström";
        isPlaying = false;
    }
    else {
        playBtn.textContent = "spela ljudström";
        isPlaying = true;
    }
});




async function playNextInQueue() {
    if (streamQueue.length > 0) {
        console.log("playing next in queue!");
        let buffer = streamQueue.shift(); // Get the next buffer from the queue
        let source = audioCtx.createBufferSource();
        source.buffer = buffer;
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
    }
    else {
    	isPlaying = false;
    }
}

async function addPcmToQueue(pcmdata){
    console.log("adding to queue!");
    //console.log(pcmdata.length);
    //console.log(pcmdata);
	let buf = audioCtx.createBuffer(1,pcmdata.length,sr);
	buf.copyToChannel(pcmdata,0);
	streamQueue.push(buf);
    if(!isPlaying && streamQueue.length >= 4){
        console.log("gainNode volume:",gainNode.volume);
        fadeIn();
        playNextInQueue();
        //isPlaying = true;
    }
}


async function fadeIn() {
    gainNode.gain.setValueAtTime(0,audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(1,audioCtx.currentTime + fadeTime / 1000);
}
    
async function fadeOut() {
    gainNode.gain.setValueAtTime(gainNode.gain.value,audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0,audioCtx.currentTime + fadeTime / 1000);
}


async function openStream(){
	if(!socket){
        console.log("opening stream!");
        let conn_str = `ws://${window.location.hostname}:3000/tidstangsel/stream?nonce=${nonce}`;
        console.log("conn_str:",conn_str);
		socket = new WebSocket(conn_str);
		socket.onopen = async () => {
    		console.log('WebSocket connection established');
		};
        socket.onmessage = async (event) => {
            if(event.data instanceof Blob){
                console.log("audio chunk received!");
                const arrayBuffer = await event.data.arrayBuffer();
                const pcmdata = new Float32Array(arrayBuffer);
                //console.log(pcmdata);
                addPcmToQueue(pcmdata);    
            }
            if(typeof(event.data) === "string"){
                console.log(event.data)
                if(event.data.message === 'init_stream'){
                    sr = parseInt(event.data.sampleRate);
                    alert("Buffrar Verner Bostöms Poesi, ljudstöm börjar om 10 sekunder");
                }
            }

        }

		socket.onerror = async (error) => {
    		console.log('WebSocket error:', error);
		};
		
		socket.onclose = async() => {
    		console.log('WebSocket connection closed');
		};
	}

}

async function closeStream(){
  	if(socket !== null){
  		fadeOut();
  		setTimeout(() => {
            console.log("socket is closing!");
  			socket.close(1000,"closed by application logic");
  			socket = null;
  			isPlaying = false;
  			streamQueue = [];
            //audioCtx.suspend();
    	},fadeTime);
	}
}

async function killStream(){
  	if(socket !== null){
        console.log("socket killed!");
  		socket.close(1000,"closed by application logic");
  		socket = null;
  		isPlaying = false;
  		streamQueue = [];
        //audioCtx.suspend();
	}
}

export {openStream, closeStream, killStream}