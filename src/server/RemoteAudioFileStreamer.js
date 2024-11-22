
const server_utils  = require('./server_utils.js');
const child_process = require('child_process');
const fs            = require('node:fs');
/*
import {elapsed_seconds, createDateNow, file_url_name} from './server_utils.js';
import {spawn}                                         from 'node:child_process';
*/
//import fs                                              from 'node:fs';
//import path                                            from 'node:path';

class RemoteAudioFileStreamer {

    constructor(audio_file_url, audio_file_dur, outpath){
        this._filename = server_utils.fileUrlName(audio_file_url);
        this._audio_file_url = audio_file_url;
        this._audio_file_dur = audio_file_dur;
        this._outpath = outpath;
        this._playlist_path = `${this._outpath}/${this._filename}.m3u8`;
        this._segment_path =  `${this._outpath}/${this._filename}.ts`;
        this._ffmpegProcess = null;
        this._stopDate = null;
        const terminateSignals = ['SIGINT', 'SIGTERM', "SIGQUIT"];
        this.#cleanupFiles();
        terminateSignals.forEach((signal) => {
            process.on(signal, () => this.#handleTermination(signal));
        });    
    }
    // Private method to handle termination signals
    #handleTermination(signal) {
        if (this._ffmpegProcess) {
            console.log(`Received ${signal}, terminating FFmpeg process...`);
            this._ffmpegProcess.kill('SIGTERM');
            this._ffmpegProcess = null;
        }
        this.#cleanupFiles();
        process.exit(0); // Exit process gracefully
    }

    // Private method to clean up generated files
    #cleanupFiles() {
        if (fs.existsSync(this._playlist_path)) {
            fs.unlinkSync(this._playlist_path);
            console.log("Deleted playlist file.");
        }
        if (fs.existsSync(this._segment_path)) {
            fs.unlinkSync(this._segment_path);
            console.log("Deleted segment file.");
        }
    }

    start_stream(){
        if(!this._ffmpegProcess){
            let ss = !this._stopDate ? 0 : server_utils.elapsedSeconds(this._stopDate) % this._audio_file_dur;
            //this.#cleanupFiles();
            this._ffmpegProcess = child_process.spawn("ffmpeg", [
                "-re",
                "-stream_loop", "-1",
                "-ss", ss,
                "-i", this._audio_file_url,
                "-f", "hls",
                "-hls_time", 3,
                "-hls_list_size", 2,
                "-hls_flags", 'single_file',
                this._playlist_path
            ]);
            this._ffmpegProcess.on('error', (err) => {
                console.error("Failed to start FFmpeg:"+err.message);
                this._ffmpegProcess.kill('SIGINT');  // Gracefully stop the ffmpeg process
                console.log("terminating ffmpeg!");
                this._ffmpegProcess = null;
                process.exit(1);
            });
        }

    }

    stop_stream(){
        if(this._ffmpegProcess){
            this._ffmpegProcess.kill('SIGINT');  // Gracefully stop the ffmpeg process
            console.log("closing ffmpeg!");
            this._ffmpegProcess = null;
            this._stopDate = server_utils.createDateNow();
            this.#cleanupFiles();
        }
    }

    is_running(){
        return this._ffmpegProcess != null;
    }
}

module.exports.RemoteAudioFileStreamer = RemoteAudioFileStreamer;
//export {RemoteAudioFileStreamer}