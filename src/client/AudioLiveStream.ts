import Hls, { Events } from 'hls.js';
import {ErrorTypes} from 'hls.js';
import eventBus from './EventBus';
import { get_event_name } from './tidstangsel_constants';

enum AudioLiveStreamState {
    closed = 0,
    open = 1,
    playing = 2
}


class AudioLiveStream {
    private _state          : AudioLiveStreamState = AudioLiveStreamState.closed;
    private _streamUrl      : string;
    private _fadeTime       : number;
    private _supported      : boolean;
    private _streamBackend  : string;
    private _audioElement   : HTMLAudioElement;
    private _audioCtx       : AudioContext | null;
    private _gainNode       : GainNode | null
    private _streamSrc      : MediaElementAudioSourceNode | null;
    private _hls            : Hls | null;

    private fadeIn() {
        this._gainNode!.gain.setValueAtTime(0, this._audioCtx!.currentTime);
        this._gainNode!.gain.linearRampToValueAtTime(1, this._audioCtx!.currentTime + this._fadeTime / 1000);
    }
    
    private fadeOut() {
        this._gainNode!.gain.setValueAtTime(this._gainNode!.gain.value, this._audioCtx!.currentTime);
        this._gainNode!.gain.linearRampToValueAtTime(0, this._audioCtx!.currentTime + this._fadeTime! / 1000);
    }

    private async free(event_to_emit:string){
        this._hls?.destroy();
        this._audioElement.src = '';
        this._audioCtx?.close().then(()=> {
            this._streamSrc = null;
            this._audioCtx = null;
            this._gainNode = null;
            this._streamSrc = null;
            this._state = AudioLiveStreamState.closed;
            console.log("stream closed");
            if(event_to_emit){
                eventBus.emit(get_event_name("stream",event_to_emit),{});
            }

        }).catch((error)=> {
            console.error("error trying to free stream");
        })
    }


    constructor(stream_url:string, fade_time:number = 4000){
      this._hls      = null;
      this._audioCtx = null;
      this._gainNode = null;
      this._streamSrc = null;
      this._streamUrl = stream_url
      this._fadeTime  = fade_time;
      this._audioElement = new Audio();
      this._audioElement.setAttribute("id","audio_element");
      this._audioElement.hidden = true;
      document.body.append(this._audioElement);
      this._supported = Hls.isSupported() || this._audioElement.canPlayType('application/vnd.apple.mpegurl') as string === "probably";
      if(this._supported){
        this._streamBackend  = Hls.isSupported() ? "hls" : "mext";
      }
      else {
        this._streamBackend = "none";
      }
    }

    setstreamUrl(url:string){
        this._streamUrl = url;
    }

    stream_supported(){return this._supported;}

    open_stream(){
        if(this._supported && this._state == AudioLiveStreamState.closed){
            this._audioCtx       = new AudioContext();
            this._gainNode       = this._audioCtx.createGain();
            this._streamSrc      = this._audioCtx.createMediaElementSource(this._audioElement!);
            this._streamSrc.connect(this._gainNode);
            this._gainNode.connect(this._audioCtx.destination);
            if(this._streamBackend === "hls"){
                this._hls = new Hls({ maxBufferHole: 2, debug: true });
                try {
                    this._hls.loadSource(this._streamUrl);
                    this._hls.attachMedia(this._audioElement);
                } catch(error){
                    console.error(error);
                    this.free("cannot_load");
                    return;
                    //want to break out of the if clause here and prevent the following code from executing"
                }
                this._audioElement.muted = true;
                this._audioElement!.play().then(() => {
                    console.log("stream is playing");
                    this._state = AudioLiveStreamState.playing;
                    this._audioElement!.muted = false;
                    this.fadeIn();  // Fade in the audio
                }).catch((err) => {
                    this._audioElement.muted = false;
                    console.log("autoplay failed");
                    this.free("autoplay_failed");
                    return;
                });
                this._hls.on(Events.ERROR,(event:any, data:any) => {
                    const { type, details, fatal } = data;
                    console.log("Error Type:", type);
                    console.log("Error Details:", details);
                    console.log("Is Fatal:", fatal);
        
                    if (fatal) {
                        switch (type) {
                            case ErrorTypes.NETWORK_ERROR:
                                try {
                                    this._hls!.startLoad();
                                } catch(error) {
                                    console.error(error);
                                    this.free("network_error");
                                }
                                break;
                            case ErrorTypes.MEDIA_ERROR:
                                try {
                                    this._hls!.recoverMediaError();
                                } catch(error) {
                                    console.error(error);
                                    this.free("media_error");
                                }
                                break;
                            default:
                                console.error(data.type);
                                this.free("fatal_error");
                                break;
                        }
                    }
                });
            }
            if(this._streamBackend === "mext"){
                try {
                    console.log("mext!");
                    this._audioElement.src = this._streamUrl;
                }
                catch(error){
                    console.log("cannot load");
                    this.free("cannot_load");
                    return;
                }
                this._audioElement.muted = true; // Mute initially
                this._state = AudioLiveStreamState.open;
                this._audioElement.play().then(() => {
                    console.log("stream is playing");
                    this._state = AudioLiveStreamState.playing;
                    this._audioElement.muted = false;
                    this.fadeIn();
                }).catch((err) => {
                    this._audioElement.muted = false;
                    console.log("autoplay failed");
                    this.free("autoplay_failed");
                });
            }
        }
        else {
            console.error("unexpected call to AudioLiveStream");
        }
    }

    close_stream(){
        if(this._state == AudioLiveStreamState.open){
            console.log("stream is closing");
            this.free("stream_closed");
        }
        if(this._state == AudioLiveStreamState.playing){
            setTimeout(() => {
                console.log("stream is closing");
                this.free("stream_closed");
            },this._fadeTime);
        }
    }

    kill_stream(){
        if(this._state == AudioLiveStreamState.open || this._state == AudioLiveStreamState.playing){
            this.free("stream_killed");
        }  
    }

    getState(){
        return this._state;
    }

    mute(){
        if(this._state == AudioLiveStreamState.playing){
            this._audioElement.muted = true;
        }
    }

    unmute(){
        if(this._state == AudioLiveStreamState.playing){
            this._audioElement.muted = false;
        }
    }


}

export {AudioLiveStream}



/*





const fade_time    : number             = 4000;
var audio_element  : HTMLAudioElement   = new Audio();
var stream_backend : string | undefined = undefined;
var hls            : Hls    | undefined = undefined;
audio_element.setAttribute("id","audio_element");
audio_element.hidden = true;
document.body.append(audio_element);


if (!audio_element) {
    audio_element = new Audio();
    audio_element.setAttribute("id","audio_element");
    audio_element.hidden = true;
    document.body.append(audio_element);
    //throw new Error("Audio element not found. Ensure it exists in the DOM.");
}


if (Hls.isSupported()) {
    stream_backend = "hls";
} else if (audio_element.canPlayType('application/vnd.apple.mpegurl')) {
    stream_backend = "media source extensions";
} else {
    eventBus.emit(get_event_name("app","unsupported"),{});
}

//var audioCtx = new(window.AudioContext || window.webkitAudioContext)();
var audioCtx  = new AudioContext();
var gain_node = audioCtx.createGain();
var audio_src = audioCtx.createMediaElementSource(audio_element);
audio_src.connect(gain_node);
gain_node.connect(audioCtx.destination);

function fadeIn(duration = fade_time) {
    gain_node.gain.setValueAtTime(0, audioCtx.currentTime);
    gain_node.gain.linearRampToValueAtTime(1, audioCtx.currentTime + duration / 1000);
}

function fadeOut(duration = fade_time) {
    gain_node.gain.setValueAtTime(gain_node.gain.value, audioCtx.currentTime);
    gain_node.gain.linearRampToValueAtTime(0, audioCtx.currentTime + duration / 1000);
}


function open_stream(stream_url:string) {
    if (stream_backend === "hls") {
        hls = new Hls({ maxBufferHole: 2, debug: true });
        hls.loadSource(stream_url);
        hls.attachMedia(audio_element);
        audio_element.play();
        hls.on("hlsError",(event:any, data:any) => {
            const { type, details, fatal } = data;
            console.log("Error Type:", type);
            console.log("Error Details:", details);
            console.log("Is Fatal:", fatal);

            if (fatal) {
                switch (type) {
                    case ErrorTypes.NETWORK_ERROR:
                        eventBus.emit(get_event_name("stream","network_error"), data);
                        try {
                            hls!.startLoad();
                        } catch {

                        }
                        break;
                    case ErrorTypes.MEDIA_ERROR:
                        eventBus.emit(get_event_name("stream","media_error"), data);
                        hls!.recoverMediaError();
                        break;
                    default:
                        eventBus.emit(get_event_name("stream","fatal_error"), data);
                        hls!.destroy();
                        break;
                }
            }
        });


    } else if (stream_backend === "media source extensions") {
        audio_element.src = stream_url;
        audio_element.play
    } else {
        eventBus.emit("unexpected_error", {msg:"browser unsupported!"});
        alert("din webbläsare stöds ej!");
    }
}

function close_stream(duration = fade_time) {
    fadeOut(duration);
    setTimeout(() => {
        if (stream_backend === "hls" && hls) {
            hls.destroy();
        } else {
            audio_element.src = '';
        }
        audioCtx.close();
    }, duration);
}

const stream_supported : boolean = Hls.isSupported() || audio_element.canPlayType('application/vnd.apple.mpegurl') == "probably";

export { open_stream, close_stream, stream_supported };

*/