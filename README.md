## This is the development branch, Use this for development

# Tidstangsel
Live audio broadcast of Verner Boströms poetry, when inside a geographic perimeter

Development setup:
(1) Clone the repo:

	git clone https://github.com/andersskoog/Tidstangsel.git

(2) if you do not have node.js installed, install it, otherwise proceed to the next step.  

	npm install -g bun // will install the bun run-time globaly

alterntively you can download and run the bash install script for bun from here: https://bun.sh/install

(3) then from inside the cloned repo do:

	bun install

this will install playwright testing framework, if you dont want to install this you can skip this or modify the package.json file to suit your needs.
the actual source code does not rely upon any other dependecies than what exist natively in node and bun.

To Test and run the code meant for production locally:
(1) create or modify the .env or otherwise make sure the these environment variables are set: 

	AUDIO_URL=https://filebrowser-production-288f.up.railway.app/api/public/dl/muchcvdH/tidstangsel_mono.wav 
	AUDIO_FULL=true // app is instructed to download the whole 5 hour wav file and loads 1.4gb of audio data directly into memory
	SIMULATE_GEO_POS=false //will not build the client_simpos.js and the code it loads
	USE_CSP=true //will use a restrictive content security policy
	HOST=0.0.0.0 //listen on all network interfaces
	PORT=3000 //the port which the http server and websocket server will listen on

(2)
then do:

	bun build_client.js // will bundle the client code meant for production into the ./dist directory into a file called client_bundle.js 
	bun run server_prod

as of now there is a .wav file remotely hosted and publicly accessible at the url specified in the AUDIO_URL environment varible.
the sound quality is not the best, it is the pcm decoded from an original 356/kbs stereo .mp3 file which I have reduced to 64/kbs and changed samplerate to 
44.1 khz then converted into mono. if you want to stream another file you should change this url to reflect the audio file you want the app 
to download and stream, but the file must be publicly accessible on the internet. you cannot use an .mp3 file or other compressed formats, 
I have tried to get this to work but have not found any reliably working mp3-decoders for javascript, and to write one yourself is very hard and would require a lot of work. also in the end every audio mp3 player works by decoding into the raw-pcm data which is the acutal data we want because the app do not rely on the HTML-5 audio player but instead use The WebAudio api and plays it back directly from a buffer containing the raw pcm samples.
the reason we dont preload the raw audio data in the docker container is because the the docker image would be unpractically large
so remember: currently the app will only stream 16bit 441.Khz mono .wav files!

If you want to test the app without having to be physically located within the geographical perimeter, you could either find some way to spoof your geolocation
(If you have chrome you can do this inside sensors tab in dev-tools, but you need to reload the page if you change it so it is still not 
so practical for this reason) otherwise you can build a test version of the app by setting these environment variables before 
you run the build_client script and start the server

	AUDIO_URL=https://filebrowser-production-288f.up.railway.app/api/public/dl/muchcvdH/tidstangsel_mono.wav 
	AUDIO_FULL=false // app is instructed to download the first 30seconds of the .wav file
	SIMULATE_GEO_POS=true //will bundle the client_simpos.js instead of client.js and the code it loads
	USE_CSP=true //will use a restrictive content security policy could be set to false also if you want to load remote resources in development
	HOST=0.0.0.0 
	PORT=3000

then do:

	bun build_client.js // will bundle the client code meant for production into the ./dist directory into a file called client_bundle.js 
	bun run server_dev

NOTICE:
As of now we do not copy over the original client source files in the docker container meant for hosting. 
therefore if you make changes to the client code and want to deploy these changes: 
dont forget to run: 	

	bun run build_client 

before you commit and push the changes.

TODO:
Write playwright tests

