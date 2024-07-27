const fs = require('fs'),
    os = require('os'),
    {join} = require('path'),
    crypto = require('crypto'),
    {machineIdSync} = require('node-machine-id'),
    c = require('./constants'),
    flashKey = require('./flashKey'),
    ALGORITHM = 'aes-128-cbc',
    SEPARATOR = '|',
    accounts = {};

if (!fs.existsSync('./data')) fs.mkdirSync('./data');

let uuid;

function decrypt(data) {
    const splitData = data.split(SEPARATOR);
    const initializationVector = Buffer.from(splitData[0], 'hex');
    const encryptedData = Buffer.from(splitData[1], 'hex');
    if (!uuid) uuid = [os.platform(), os.arch(), machineIdSync(), os.cpus().length, os.cpus()[0].model].join();
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

const {hm1} = createHmEncoders();

const keydataPath = join(c.zaap, "keydata");

let wakfuInterface = 1;

function setWakfuInterface(accountId) {
    if (!accounts[accountId]['wakfuInterface']) {
        accounts[accountId]['wakfuInterface'] = wakfuInterface;
        wakfuInterface++;
    }
}

function watch(accountId, file) {
    fs.watchFile(file, {interval: 1000}, () => {
        try {
            accounts[accountId] = {
                ...accounts[accountId],
                ...JSON.parse("" + fs.readFileSync(file))
            };
            setWakfuInterface(accountId);
        } catch (e) {

        }
    });
}

fs.existsSync(keydataPath) && fs.readdirSync(keydataPath).forEach(file => {
    try {
        const decrypted = decrypt(fs.readFileSync(join(keydataPath, file)).toString());
        const {accountId} = decrypted;
        accounts[accountId] = decrypted;
        accounts[accountId]['hm1'] = hm1;
        accounts[accountId]['hm2'] = hm1.split("").reverse().join("");
        const path = join("./data/", "" + accountId);
        if (fs.existsSync(path)) {
            const account = JSON.parse("" + fs.readFileSync(path));
            for (const p of ['localAddress', 'proxy', 'alias', 'flashKey', 'wakfuInterface']) account[p] && (accounts[accountId][p] = account[p]);
        } else {
            accounts[accountId].flashKey = flashKey();
            fs.writeFileSync(path, JSON.stringify(accounts[accountId], null, 4));
        }
        setWakfuInterface(accountId);
        accounts[accountId].launcher = true;
    } catch (e) {
        console.log("error for account", file, e);
    }
});

const dataPath = "./data/";

fs.existsSync(dataPath) && fs.readdirSync(dataPath).forEach(accountId => {
    if (isNaN(Number(accountId))) return;
    const path = join(dataPath, accountId);
    const account = JSON.parse(fs.readFileSync(path).toString());
    if (account.deleted) return delete accounts[accountId];
    if (account.added) {
        accounts[accountId] = account;
        setWakfuInterface(accountId);
        watch(accountId, path);
    }
});


module.exports = accounts;
