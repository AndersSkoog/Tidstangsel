if (Bun.env.SIMULATE_GEO_POS === "true") {
	console.log("building simpos_version");
	Bun.build({
		entrypoints: ["./client_simpos.js"],
		outdir: ".",
		minify: false,
		env: "inlive",
		target: "browser",
		naming: "client_bundle.js",
	}).then((result) => console.log("client build ready!", result));
} else {
	console.log("building no_simpos_version");
	Bun.build({
		entrypoints: ["./client.js"],
		outdir: ".", // Specify the directory for the bundled script
		minify: false, // Optional: Minify the output
		env: "inline",
		target: "browser", //Specify the target environment
		naming: "client_bundle.js",
	}).then((result) => console.log("client build ready!", result));
}
