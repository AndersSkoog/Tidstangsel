const {Database} = require("bun:sqlite");
//create a database file in the root directory if it does not exist, and instantiates a database connection. 
const db = new Database("sessions.sqlite", { create: true });
//regular expression for determining if a string is an ip address
const ipv6Pattern =
	/^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
const ipv4Pattern =
	/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT NOT NULL,
    nonce TEXT NOT NULL,
    expirestr TEXT NOT NULL
  )
`);

const insert_session = db.prepare("INSERT INTO sessions (ip,nonce,expirestr) VALUES ($ip,$nonce,$expirestr)");
const query_session = db.query("SELECT * FROM sessions WHERE ip = $ip AND nonce = $nonce");
const find_by_ip = db.query("SELECT * FROM sessions WHERE ip = $ip");
const delete_session = db.prepare("DELETE FROM sessions WHERE ip = $ip");
const delete_all = db.prepare("DELETE FROM sessions");
const query_all = db.query("SELECT * FROM sessions");
const insert_multiple = db.transaction((sessions) => {
	for (const session of sessions) insertSession.run(session);
});

function isValidIP(str) {
	return ipv4Pattern.test(str) || ipv6Pattern.test(str);
}

function expireStr(numberofhours) {
	let now = new Date();
	now.setSeconds(now.getSeconds() + 60 * 60 * numberofhours);
	return now.toUTCString();
}

function notExpired(utcstring) {
	let now = new Date();
	return now > new Date(utcstring);
}

function findByIp(ip) {
	let result = find_by_ip.get({ $ip: ip });
	console.log("findByIp", result);
	return result;
}

function validateSession(ip, nonce) {
	let result = query_session.get({ $ip: ip, $nonce: nonce }) !== null;
	console.log("validateSession", result);
	return result;
}

function querySession(ip, nonce) {
	let result = query_session.get({ $ip: ip, $nonce: nonce });
	console.log("querySession", result);
	return result;
}

function deleteSession(ip) {
	let result = delete_session.get({ $ip: ip });
	console.log("deleteSession", result);
	return result;
}

function insertSession(ip, nonce) {
	if (!findByIp(ip)) {
		let expirestr = expireStr(24);
		let result = insert_session.run({
			$ip: ip,
			$nonce: nonce,
			$expirestr: expirestr,
		});
		console.log("insertSession", result);
		return result;
	} else {
		console.log(null);
		return null;
	}
}

module.exports.isValidIP = isValidIP;
module.exports.notExpired = notExpired;
module.exports.findByIp = findByIp;
module.exports.validateSession = validateSession;
module.exports.deleteSession = deleteSession;
module.exports.insertSession = insertSession;
module.exports.querySession = querySession;

/*
export {
	isValidIP,
	notExpired,
	findByIp,
	validateSession,
	deleteSession,
	insertSession,
	querySession
};

async function checkIP(ip){
    try {
  		let result = await db.query(`SELECT * FROM sessions WHERE ip = ${ip}`).get();
  		console.log(result);
  		if(result){
			let not_expired = notExpired(result.expires);
			return {status:"ok",exist:true,not_expired:not_expired,nonce:result.nonce};
		}	
  		else {
  			//console.log(result);
  			return {status:"ok",exist:false,result:result};
  		}
	} catch (err) {
  		console.error('database error:', err);
  		return "error";
	}
}

async function validateSession(ip,nonce,expireCheck=false){
	if(isValidIP(ip)){
		let resobj = await checkIP(ip);
		if(resobj.exist && res.status === "ok"){
			return expireCheck ? resobj.not_expired && resobj.result.nonce === nonce : resobj.result.nonce === nonce; 
		}
		else {
			return false
		}
	}
	else {
		return false
	}
}

async function createSession(ip,nonce){
	if(isValidIP(ip)){
		let checkObj = await checkIP(ip);
		if(checkObj.status === "ok"){
			if(checkObj.exist === false){
    			let expires = getExpireDateString(24);
        		console.log(`ip:${ip} nonce:${nonce} expires:${expires}`);
    			try {
  					await db.run(`INSERT INTO sessions (nonce, ip, expires) VALUES (${nonce}, ${ip}, ${expires})`);
  					return {status:"ok",nonce:nonce};
				} catch (err) {
  					console.error('database error:', err);
  					return {status:"error",message:err};
				}
			}
			else {
				return {status:error,message:"ip already exist"};
			}
		}
	}
	else {
		return {status:"error",message:"invalid ip"};
	}
}

async function deleteSession(ip){
	if(isValidIP(ip)){
		let checkObj = await checkIP(ip);
		if(checkObj.status === "ok"){
			if(checkObj.exist === true){
    			try {
  					let result = await db.run(`DELETE FROM sessions WHERE ip = ${ip}`);
  					return {status:"ok",result:result};
				} catch (err) {
  					console.error('database error:', err);
  					return {status:"error",message:err};
				}
			}
			else {
				return {status:"error",message:"ip does not exist"};
			}
		}
	}		
	else {
		return {status:"error",message:"invalid ip"};	
	}
}
export {validateSession,createSession,deleteSession,checkIP,notExpired,isValidIP,db,expireStr};
module.exports.validateSession = validateSession;
module.exports.createSession = createSession;
module.exports.deleteSession = deleteSession;
module.exports.checkIP = checkIP;
module.exports.notExpired = notExpired;
module.exports.isValidIP = isValidIP;
*/
