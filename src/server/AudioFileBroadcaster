/*
The Audiofilebroadcaster currently works by reading arbitary large uncompressed audio files by loading it into successive chunks procedurally at runtime.
When the broadcaster is active, it will continue to load chunks indefenetly and read those those chunks into a one second binary buffer at playback speed by calling the setInterval routine.
Thus, at periodic intervals of one second the playbuffer is populated with a one second slice of the loaded chunk.
By loading the file into chunks procedurally synchronized with the playback speed, we can broadcast very large wav files without using up 
large amouts of memory on the host machine.


The chunkSize of the chunk buffer is calculated during initiation to always be equaly divisible to a total file data size in bytes, 
this is achived by padding the the original file size with an appended buffer of zeores(i.e silence) at the end of the file, whereby: 

    padSize   = chunkSize - (total data size of original file % chunkSize) at the end of the file. and
    dataSize  = total data size of original file + padSize

The size of the chunks can thus be specified as an argument to be a value in seconds, 

    chunkDur:int >= 5. 
    (It would not make so much sense to have a chunk duration less than 5 seconds because the playback buffer is 1 second, 
    also: a feasble number balancing both loading time, and possible client network limitations would probably be around 10-20 seconds ?

If the file is not accessible on the host machine but is hosted on a remote Cloud CDN,
the Audiofilebroadcaster currently features a mechanism to stop the loading of chunks if no one is requesting the stream.
The reason for this is to prevent unecessary costs associated with the use of what clould provides call bandwidth (which is the amount of data that has been downloaded each mounth from the CDN host provider) 
When the stream is requested again, it will play back the stream as if it had been played back uninteruptedly, this by
taking the remainder between how many seconds that has elapsed since it was stoped and the total duration of the file in seconds.
from this it will calculate which chunk to first load and which second in the chunk to to start populating the playback buffer.
This way there will be no precieved difference from having the program instructed to download new chunks indefintely even if no one is requesting it.
(Which would be very expensive to do because it would constantly download the whole file over and over again, until the server program exits)

TODO: 
* Implement the option to download chunks from remote audio files, currently the AudioFilebroadcaster assumes there is a local file at the provided filePath on the host filesystem
* Implement a way to decode data from other compressed file formats like mp3, currently the Audiofilebroadcaster assumes the file to contain uncompressed binary data,
* Questions of design decision: 
    (1)

        If we already need to decode audio data from compressed file formats like mp3, would it make sense to let the Audiofilebroadcaster have the option 
        of outputing decoded PCM data instead of binary so that the stream can be directly played back on the client by the HTML <audio> player or 
        by the WebAudio API, or should we instead delegate the decoding task to the client? What are the pros and cons?
    
    (2)

       Should we provide the option to specify the size of the playbackbuffer in seconds rather than always having it set to 1 second?
       The benefits of having a larger playbackbuffer would be that, if someone is accessing the stream with a slow internet connection
       the client would have a larger margin of prebuffered data, but having it too large would also introduce latency between different clients.  

*/


import { createDateNow, elapsedSeconds } from "./server_utils";
import { promises, appendFile} from "node:fs"


type AudioFileInfo = {
  filePath:string,
  channels:number,
  sampleRate:number,
  bytesPerSec:number,
  bytesPerSample:number,
  bitDepth:number,
  dataSize:number,
  chunkSize:number,
  padSize:number,
  chunkDur:number,
  duration:number,
  totalChunks:number,
  playBufSize:number
}



//calculate the info needed by the AudioFileBroadcaster from a file header given a file path and a chunk duration in seconds
async function getWavFileInfo(filePath:string, chunkDur:number) : Promise<AudioFileInfo> {
    //allocate empty buffer for the file header
    const header = Buffer.alloc(44); // 44 bytes for WAV header
    try {
        let fh = await promises.open(filePath, 'r');
        await fh.read(header, 0, 44, 0);
        await fh.close();
        let fmt = header.toString('ascii', 8, 12);
        if(fmt !== "WAVE"){
            throw "the file is not a wav file"
        }
        const channels       = header.readUInt16LE(22);       // Number of channels
        const sampleRate     = header.readUInt32LE(24);       // Sample Rate
        const bytesPerSec    = header.readUInt32LE(28);       // Not a fixed value if the audio data is compressed, will only work for uncompressed file formats
        const bytesPerSample = header.readUInt16LE(32);       // Bytes per sample = (bitdepth / 8) * number of channels
        const bitsPerSample  = header.readUInt16LE(34);       // Bits per sample = bit depth
        const orgDatasize    = header.readUInt32LE(40);       // Original data size of the file
        const chunkSize      = bytesPerSec * chunkDur;
        const padSize        = chunkSize - (orgDatasize % chunkSize);
        const dataSize       = orgDatasize + padSize;
        const duration       = dataSize / bytesPerSec;
        const totalChunks    = dataSize / chunkSize;
        const playBufSize    = bytesPerSec;
        return {
          filePath:filePath,
          channels:channels,
          sampleRate:sampleRate,
          bytesPerSec:bytesPerSec,
          bytesPerSample:bytesPerSample,
          bitDepth:bitsPerSample,
          dataSize:dataSize,
          chunkSize:chunkSize,
          padSize:padSize,
          chunkDur:chunkDur,
          duration:duration,
          totalChunks:totalChunks,
          playBufSize:playBufSize
        }

    } catch (err) {
        console.error('Error reading WAV file:', err);
        throw "could not read wav file"
    }
}


class AudioFileBroadcaster {
    private info          : AudioFileInfo;
    private fileCursor    : number = 0;
    private chunkCursor   : number = 0;
    private currentChunk  : number = 0;
    private state         : "stoped" | "playing" = "stoped";
    private curChunkData  : Buffer;
    private secChunkData  : Buffer;
    private ivId          : NodeJS.Timeout | null = null;
    private hasloadedData : boolean = false;
    private stopDate      : Date | null = null;
    private playBuf       : Buffer | null = null;


    constructor(fileInfo:AudioFileInfo){
        this.info = fileInfo;
        appendFile(this.info.filePath,Buffer.alloc(this.info.padSize,0),()=>{});
        this.curChunkData = Buffer.alloc(this.info.chunkSize);
        this.secChunkData = Buffer.alloc(this.info.chunkSize); 
        this.playBuf      = Buffer.alloc(this.info.playBufSize);  
    }

    async startStream() {
        if(this.state === "stoped"){
            //if no stop date, will load the chunk at the begining of the file : else calculate how many seconds that has elapsed since stop date % total duration of file
            let ss = !this.stopDate ? 0 : elapsedSeconds(this.stopDate) % this.info.duration;
            //the index of the chunk containing the calculated second in the file
            let cindex        = Math.floor(ss / this.info.chunkDur);
            //
            let rem           = cindex - (ss / this.info.chunkDur);
            let sec           = Math.floor(this.info.chunkDur * rem);
            this.chunkCursor  = sec;
            this.fileCursor   = ss; 
            // Load the initial two chunks
            await this.#loadChunk(this.curChunkData, cindex);
            await this.#loadChunk(this.secChunkData, cindex + 1);
            this.currentChunk = cindex + 1;
            this.hasloadedData = true;
            //this.playStream();
        }
    }

    async #loadChunk(chunk_buf:Buffer, chunk_index:number) {
        try {
            let fh = await promises.open(this.info.filePath, 'r');
            let offset = chunk_index * this.info.chunkSize;
            await fh.read(chunk_buf, 0, this.info.chunkSize, offset);
            await fh.close();
            console.log(`Chunk ${chunk_index} loaded successfully.`);
        } catch (err) {
            console.error('Error reading file:', err);
        }
    }

    playStream(){
        if(!this.ivId && this.state === "stoped" && this.hasloadedData){
            this.state = "playing";
            console.log("stream is playing");    
            this.ivId = setInterval(()=> {          
                let seconds_left = this.info.chunkDur - this.chunkCursor;
                if(seconds_left === 0){
                    this.curChunkData = this.secChunkData;
                    let offset = this.info.playBufSize * this.chunkCursor;
                    this.playBuf = Buffer.copyBytesFrom(this.curChunkData,offset,this.info.playBufSize);
                    //Buffer.copyBytesFrom(this.curChunkData,offset,this.bufSize);
                    //this.play_buf = this.cur_chunk_data.slice(offset, offset + this.bytes_per_sec);
                    this.chunkCursor = 1;
                    this.fileCursor = (this.fileCursor + 1) % this.info.duration;
                    this.currentChunk = (this.currentChunk + 1) % this.info.totalChunks;
                    this.#loadChunk(this.secChunkData,this.currentChunk);  
                }
                else {
                    let offset = this.info.playBufSize * this.chunkCursor;
                    this.playBuf = Buffer.copyBytesFrom(this.curChunkData,offset,this.info.playBufSize);
                    this.chunkCursor += 1;
                    this.fileCursor += 1;
                }
            },1000)  

        }
        console.log("could not play");     

    }

    stopStream(){
        if(this.state === "playing"){
            this.state = "stoped";
            this.stopDate = createDateNow();
            clearInterval(this.ivId!);
            this.ivId = null;
            this.fileCursor = 0;
            this.playBuf    = null;
            this.chunkCursor = 0;
            this.curChunkData.fill(0);
            this.secChunkData.fill(0);
            this.hasloadedData = false;
        }
    }

    getChunkBuffer(){
        if(this.hasloadedData && this.state === "playing"){
            return Buffer.from(this.curChunkData);
        }
        else {
            throw "trying to access empty buffer"
        } 
    }

    getPlayBuffer(){
        if(this.hasloadedData && this.state === "playing"){
            return Buffer.from(this.playBuf!);
        }    
    }
    
    getState(){
        return this.state;
    }

    /*
    TODO
    getDecodedChunkBuffer(){ 
    }

    getDecodedPlayBuffer(){
    
    }
    */
}


export {AudioFileBroadcaster, AudioFileInfo, getWavFileInfo}
