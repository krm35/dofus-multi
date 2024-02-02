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

if (fs.existsSync("./data/lang.txt")) {
    language = fs.readFileSync("./data/lang.txt").toString().split('\n')[0].split(' ')[0];
}

if (!languages.includes(language)) {
    console.log("there is a problem to get the game language, in the data folder you must create a file lang.txt");
    console.log("in this file please enter the language of the game, it can be: " + languages.join(" or "));
}

module.exports = {
    port: 0,
    version: "3.12.6",
    isTest: process.argv.includes("dev=true"),
    logs: this.isTest || !fs.existsSync("./logs"),
    uid: fs.existsSync(uidPath) ? fs.readFileSync(uidPath).toString() : null,
    language,
    zaap
};
