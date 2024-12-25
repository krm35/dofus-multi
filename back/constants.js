const os = require('os'),
    path = require('path'),
    fs = require('fs');

const zaap = process.platform === "win32" ?
    path.join(process.env.APPDATA, 'zaap') :
    process.platform === "linux" ? path.join(os.homedir(), '.config', 'zaap') :
        path.join(os.homedir(), "Library", "Application Support", 'zaap');

const uidPath = path.join(zaap.replace("zaap", "Dofus"), "uid.dat");

let language;

try {
    language = JSON.parse("" + fs.readFileSync(path.join(zaap, "repositories", "production", "dofus", "main", "settings.json")))['language']['value'];
} catch (e) {
    language = 'fr'
}

const languages = ['en', 'fr', 'es', 'it', 'de', 'pt'];

if (fs.existsSync(uidPath) && !languages.includes(language)) {
    language = 'fr'
}

module.exports = {
    port: 0,
    version: "3.12.28",
    isTest: !process.argv[1]?.includes("snapshot\\back\\index.js"),
    logs: this.isTest || !fs.existsSync("./logs"),
    uid: fs.existsSync(uidPath) ? fs.readFileSync(uidPath).toString() : null,
    language,
    zaap
};
