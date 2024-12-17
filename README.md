# Tidstangsel
Live audio broadcast of Verner Boströms poetry, when inside a geographic perimeter

Development setup: 
	Clone the repo, 
	install bun https://bun.sh on your machine, 
	then from the Cloned repo directory, do: 

	> bun install
	> bun run build_client 
	> bun run build_client_test
	
	start production server: 
	set these enviroment variables
	AUDIO_FULL=true
	SIMULATE_GEO_POS=false
	USE_CSP=true
	PORT=3000
	HOST=0.0.0.0
	then:
	> bun run start_prod
	start dev server:
	set these enviroment variables
	AUDIO_FULL=false
	SIMULATE_GEO_POS=true / or true depending on what you want
	USE_CSP=true
	PORT=3000
	HOST=0.0.0.0 
	> bun run start_dev
	
TODO:
Write playwright tests



