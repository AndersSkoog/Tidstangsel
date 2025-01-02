## This is the production branch, only push code to this branch if it works in the development branch

# Tidstangsel
Live audio broadcast of Verner Boströms poetry, when inside a geographic perimeter

Development setup:
(1) Clone the repo:

	git clone https://github.com/andersskoog/Tidstangsel.git

(2) if you do not have node.js installed, install it, otherwise proceed to the next step.  

	npm install -g bun // will install the bun run-time globaly
alterntively you can download and run the bash install script for bun from here: https://bun.sh/install

(3) install ffmpeg

(4) then from inside the cloned repo do:

	bun install

this will install playwright testing framework, if you dont want to install this you can skip this or modify the package.json file to suit your needs.
the actual source code does not rely upon any other dependecies than what exist natively in node and bun.

To Test and run the code meant for production locally:
(1) create or modify the .env or otherwise make sure the these environment variables are set: 

	AUDIO_URL=https://filebrowser-production-288f.up.railway.app/api/public/dl/qd-IZ4mI/tidsstangsel_320.mp3
	AUDIO_TEST_URL=https://filebrowser-production-288f.up.railway.app/api/public/dl/HCuuo9q0/test_mono.wav
	SIMULATE_GEO_POS=false
	HOST=0.0.0.0
	PORT=3000

(2)
then do:

	bun build_client.js // will bundle the client code meant for production
	bun run server_prod

as of now there is a .mp3 file remotely hosted and publicly accessible at the url specified in the AUDIO_URL environment varible.
when server will download the remote file if it does not exist in the file system

If you want to test the app without having to be physically located within the geographical perimeter, you could either find some way to spoof your geolocation
(If you have chrome you can do this inside sensors tab in dev-tools, but you need to reload the page if you change it so it is still not 
so practical for this reason) otherwise you can build a test version of the app by setting these the SIMULATE_GEO_POS variable before 
you run the build_client script and start the server

	SIMULATE_GEO_POS=true

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

