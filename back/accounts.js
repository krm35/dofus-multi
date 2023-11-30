const fs = require('fs'),
    os = require('os'),
    path = require('path'),
    crypto = require('crypto'),
    {machineIdSync} = require('node-machine-id'),
    c = require('./constants'),
    flashKey = require('./flashKey'),
    ALGORITHM = 'aes-128-cbc',
    SEPARATOR = '|',
    accounts = {};

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

function decrypt(data) {
    const splitData = data.split(SEPARATOR);
    const initializationVector = Buffer.from(splitData[0], 'hex');
    const encryptedData = Buffer.from(splitData[1], 'hex');
    const hash = createHashFromString(uuid);
    const decipher = crypto.createDecipheriv(ALGORITHM, hash, initializationVector);
    const decryptedData = decipher.update(encryptedData);
    const decryptedBuffer = Buffer.concat([decryptedData, decipher.final()]);
    const jsonData = decryptedBuffer.toString();
    return JSON.parse(jsonData)
}

function createHashFromStringSha(e) {
    const n = crypto.createHash("sha256");
    n.update(e);
    return n.digest("hex").slice(0, 32)
}

function getComputerRam() {
    return Math.pow(2, Math.round(Math.log(os.totalmem() / 1024 / 1024) / Math.log(2)))
}

function getOsVersion() {
    const [t, n] = os.release().split(".");
    return parseFloat(`${t}.${n}`)
}

function createHmEncoders() {
    const t = [
        os.arch(),
        os.platform(),
        machineIdSync(),
        os.userInfo().username,
        getOsVersion(),
        getComputerRam()
    ];
    const hm1 = createHashFromStringSha(t.join(""));
    const hm2 = hm1.split("").reverse().join("");
    return {hm1, hm2};
}

function createHashFromString(string) {
    const hash = crypto.createHash('md5');
    hash.update(string);
    return hash.digest()
}

const uuid = [os.platform(), os.arch(), machineIdSync(), os.cpus().length, os.cpus()[0].model].join();

const {hm1} = createHmEncoders();

const keydataPath = path.join(c.zaap, "keydata");

if (!fs.existsSync(keydataPath)) {
    console.log("Veuillez ouvrir un bug sur Github https://github.com/krm35/dofus-multi/issues")
} else {
    fs.readdirSync(keydataPath).forEach((file, i) => {
        try {
            const decrypted = decrypt(fs.readFileSync(path.join(keydataPath, file)).toString());
            const {accountId} = decrypted;
            accounts[accountId] = decrypted;
            if (!accounts[accountId]['wakfuInterface']) accounts[accountId]['wakfuInterface'] = i + 1;
            accounts[accountId]['hm1'] = hm1;
            accounts[accountId]['hm2'] = hm1.split("").reverse().join("");
            delete accounts[accountId]['wakfuPort'];
            delete accounts[accountId]['d2Port'];
            delete accounts[accountId]['retroPort'];
            if (fs.existsSync("./data/" + accountId)) {
                const account = JSON.parse("" + fs.readFileSync("./data/" + accountId));
                for (const p of ['key', 'refreshToken', 'certificate', 'hm1', 'hm2']) if (accounts[accountId][p]) delete account[p];
                accounts[accountId] = {...accounts[accountId], ...account}
            } else {
                accounts[accountId].flashKey = flashKey();
                fs.writeFileSync("./data/" + accountId, JSON.stringify(accounts[accountId]));
            }
        } catch (e) {
            console.log("error for account", file, e);
        }
    });

    fs.readdirSync("./data/").forEach(accountId => {
        if (accounts[accountId] || isNaN(Number(accountId))) return;
        accounts[accountId] = JSON.parse(fs.readFileSync(path.join("./data/", accountId)).toString());
    });
}

module.exports = accounts;
