if (Bun.env.SIMULATE_GEO_POS === "true") {
  console.log("building simpos_version");
  Bun.build({
    entrypoints: ["./client_simpos.js"],
    outdir: "./dist",
    minify: false,
    env: "inlive",
    target: "browser",
    naming: "[dir]/client_bundle.js",
  }).then((result) => console.log("client build ready!", result));
} else {
  console.log("building no_simpos_version");
  Bun.build({
    entrypoints: ["./client.js"],
    outdir: "./dist", // Specify the exact name for the bundled file
    minify: false,
    env: "inline", // Optional: Minify the output
    target: "browser", // Optional: Specify the target environmen
    naming: "[dir]/client_bundle.js",
  }).then((result) => console.log("client build ready!", result));
}

/*
This code generate a hash from the contents of the bundled client code and writes it to a text file.
We can then read this hash from the text file during start up in production in order to instigate a very secure Content Security Policy.
See reference: 
	https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP#strict_csp
*/

/*
make a hashed build
let build_file_content = await Bun.file("./dist/client_bundle.js").text();
let hasher = new Bun.CryptoHasher("sha256");
hasher.update(build_file_content);
let hash = hasher.digest("base64");
let write_result = await Bun.write("./dist/client_hash.txt",hash);
console.log(write_result);
return {success:true,hash:hash};
*/

/*
async function write_csp_hash_to_textfile(local_file_path, hash_output_file_path) {
	try {
		const hasher = new Bun.CryptoHasher("sha256");  // Create the hasher using SHA-256
  		const input_file = Bun.file(local_file_path);  // Makes a lazy file reference
  		const file_content = await input_file.text();  // Read the file's content as text
  		hasher.update(file_content);  // Update the hasher with the file content
  		const hash = hasher.digest("base64");  // Get the hash of the file in base64 format
  		// Write the hash to the specified output file
  		let write_result = await Bun.write(hash_output_file_path, hash);
  		console.log(write_result);  // log the result of the write operation
  		return { success: true, hash: hash };  // Return success status and the hash
	} catch(error){
    	// Catch and log any errors that occur
    	console.error("Error writing hash to file:", error);
    	return { success: false, error: error.message };
	}
}

write_csp_hash_to_textfile("./dist/client.js","./dist/client_hash.txt").then((ouput)=> {
	console.log(output);	
});
*/
