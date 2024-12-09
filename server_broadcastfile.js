//const utils 	      = require('./server_utils');
const https 	      = require('node:https');
//const { Buffer }      = require('node:buffer');  
const { MPEGDecoder } = require('mpg123-decoder');
const {serverEvents}  = require("./server_events");

const decoder = new MPEGDecoder();
await decoder.ready;
/*
class remoteMp3 {
	constructor(mp3url, bufdur=4){
  		this.mp3url      = mp3url;
    	this.mp3Data     = new Uint8Array(0);
    	this.bufdur      = bufdur;
    	this.clients     = new Set();
    	this.intervalId  = null;
    	this.playbufsize = null;
    	this.sr 		 = null;
    	this.dur         = null;
    	this.decodeObj   = null;
    	this.ready 	     = false;
    	this.outA  		 = 
    	this.cursor 	 = 0;
    	this.outBuf	     = null;
    	//this.outBufR 	 = null;
    	this.#startDownload();	
  	}

  	#startDownload(){
  		if(!this.ready && !this.decodeObj){
  			https.get(mp3url, (res) => {
      			console.log('statusCode:', res.statusCode);
      			console.log('headers:', res.headers);
      			res.on('data', (d) => {
        			this.mp3data = this.#concat(this.mp3Data,new Uint8Array(d));
      			});
      			res.on('end',()=> {
        			this.decodeObj   = decoder.decode(mp3Data);
        			this.sr          = this.decodeObj.sampleRate;
        			this.dur         = Math.floor(this.decodeObj.samplesDecoded / this.sr);
        			this.playbufsize = this.sr;
        			this.outBufL	 = this.decodeObj.channelData[0].slice(0,this.playbufsize);
        			//this.outBufR	 = this.decodeObj.channelData[1].slice(0,this.playbufsize);
        			this.mp3data     = new Uint8Array(0);
        			this.ready       = true;
        			serverEvents.emit('download_finished');
      			});
      			res.on('error',(err)=> console.log(err));
      
      		}).on('error', (e) => {
        		console.error(e);
    		});
  		}
  	}

  	#concat(arr1, arr2) {
    	const concatenated = new Uint8Array(arr1.length + arr2.length);
    	concatenated.set(arr1);
    	concatenated.set(arr2, arr1.length);
    	return concatenated;
  	}

    addClient(resp_obj){
    	this.clients.add(resp_obj);
    }

    removeClient(resp_obj){
    	this.clients.delete(resp_obj);
    }

    clientExist(resp_obj){
        return this.clients.has(resp_obj);
    }


  	startStream(){
    	if(!this.intervalId){
    		this.intervalId = startInterval(()=> {
    			this.clients.forEach((c)=> {c.write(this.outBuf);});
    			this.cursor    = (this.cursor + 1) % (this.dur - 1);
    			let start      = this.playbufsize * this.cursor;
    			let end        = start + this.playbufsize;
    			this.outBuf    = this.decodeObj.channelData[0].slice(start,end);
    		}, 1000);
    	}
  	}

  	stopStream(){
    	if(this.intervalId){
    		clearInterval(this.intervalId);
    		this.intervalId = null;
    		this.cursor = 0;
    	}
  	}
}
*/

class RemoteMp3 {

    constructor(mp3url){
        this.mp3url      = mp3url;
        this.mp3Data     = new Uint8Array(0);
        this.bufdur      = bufdur;
        this.clients     = new Set();
        this.intervalId  = null;
        this.playbufsize = null;
        this.sr          = null;
        this.dur         = null;
        this.decodeObj   = null;
        this.ready       = false;
        this.outBuf      = null;
        //this.outBufR   = null;
        this.#startDownload();  
    }

    #startDownload(){
        if(!this.ready && !this.decodeObj){
            https.get(mp3url, (res) => {
                console.log('statusCode:', res.statusCode);
                console.log('headers:', res.headers);
                res.on('data', (d) => {
                    this.mp3data = this.#concat(this.mp3Data,new Uint8Array(d));
                });
                res.on('end',()=> {
                    this.decodeObj   = decoder.decode(mp3Data);
                    this.sr          = this.decodeObj.sampleRate;
                    this.dur         = Math.floor(this.decodeObj.samplesDecoded / this.sr);
                    this.mp3data     = new Uint8Array(0);
                    this.ready       = true;
                    serverEvents.emit('download_finished');
                });
                res.on('error',(err)=> console.log(err));
      
            }).on('error', (e) => {
                console.error(e);
            });
        }
    }

    #concat(arr1, arr2) {
        const concatenated = new Uint8Array(arr1.length + arr2.length);
        concatenated.set(arr1);
        concatenated.set(arr2, arr1.length);
        return concatenated;
    }

    getDur(){
        return this.dur;
    }

    getSr(){
        return this.sr;
    }  

    isReady(){
        return this.ready;
    }  

    getDecodedChunk(cursor){
        if(this.ready){  
            let c = cursor % (this.dur - 1);
            let start = this.sr * c;
            let end   = start + this.sr;
            return this.decodeObj.channelData[0].slice(start,end);   
        }
    }
}

module.exports.RemoteMp3 = RemoteMp3;

