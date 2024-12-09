function createDate(arr){
    if(arr.length !== 6){throw "error creating date"}
    let dstr = `${arr[0]}/${arr[1]}/${arr[2]}`;
    let d = new Date(dstr);
    if(d.toString() === 'Invalid Date'){throw "error creating date";}
    else {
      let c1 = arr[3] >= 0 && arr[3] <= 23;
      let c2 = arr[4] >= 0 && arr[4] <= 59;
      let c3 = arr[5] >= 0 && arr[5] <= 59;
      if(c1 && c2 && c3){
        d.setHours(arr[3]);
        d.setMinutes(arr[4]);
        d.setSeconds(arr[5]);
        return d;
      }
      else {
        throw "error creating date";
      }
    }
}

function createDateNow(){
  let dn = new Date();
  return createDate([dn.getFullYear(),dn.getMonth(),dn.getDate(),dn.getHours(),dn.getMinutes(),dn.getSeconds()]);
}

function elapsedSeconds(past_date){
    let now = new Date();
    return (now - createDate(past_date)) / 1000;
}

function fileUrlParts(urlstr){
  let url = new URL(urlstr);
  let [filepath, file] = [url.pathname.slice(0, url.pathname.lastIndexOf('/')), url.pathname.split('/').pop()];
  let [filename, ext] = file.split('.');
  return {filepath:filepath,filename:filename,ext:"."+ext}
}

function fileUrlName(urlstr){
  return new URL(urlstr).pathname.split("/").pop().split(".")[0]
}

function fileUrlExt(urlstr){
  return "." + new URL(urlstr).pathname.split("/").pop().split(".")[1]
}

module.exports.createDate      = createDate;
module.exports.createDateNow   = createDateNow;
module.exports.elapsedSeconds  = elapsedSeconds;
module.exports.fileUrlParts    = fileUrlParts;
module.exports.fileUrlName     = fileUrlName;
module.exports.fileUrlExt      = fileUrlExt;
