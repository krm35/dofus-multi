const os = require('os'),
    path = require('path'),
    fs = require('fs');

const zaap = process.platform === "win32" ?
    path.join(process.env.APPDATA, 'zaap') :
    process.platform === "linux" ? path.join(os.homedir(), '.config', 'zaap') :
        path.join(os.homedir(), "Library", "Application Support", 'zaap');

const uidPath = path.join(zaap.replace("zaap", "Dofus"), "uid.dat");

module.exports = {
    port: 0,
    version: "3.11.4",
    isTest: process.argv.includes("dev=true"),
    logs: this.isTest || !fs.existsSync("./logs"),
    uid: fs.existsSync(uidPath) ? fs.readFileSync(uidPath).toString() : null,
    zaap
};