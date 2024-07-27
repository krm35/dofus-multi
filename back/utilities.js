const fs = require('fs'),
    crypto = require('crypto'),
    c = require('./constants'),
    wss = require('./wss'),
    accounts = require('./accounts');

module.exports.wait = (time) => new Promise(resolve => setTimeout(resolve, time ? time : 10));

module.exports.logs = (...log) => c.logs && console.log(...log);

const saveAccount = function (account) {
    const toSave = JSON.parse(JSON.stringify(accounts[account]));
    delete toSave['wakfuPort'];
    delete toSave['d2Port'];
    delete toSave['retroPort'];
    fs.writeFileSync("./data/" + account, JSON.stringify(toSave, null, 4));
};

module.exports.saveAccount = saveAccount;

module.exports.deleteAccount = function (account) {
    accounts[account].deleted = true;
    saveAccount(account);
};

module.exports.broadcast = function (account) {
    wss.broadcast({resource: "accounts", key: account, value: accounts[account]});
};

module.exports.generateHashFromCertif = function (hm1, certif) {
    const hm2 = hm1.split("").reverse().join("");
    const i = crypto.createDecipheriv("aes-256-ecb", hm2, ""),
        r = Buffer.concat([i.update(certif['encodedCertificate'], "base64"), i.final()]);
    return crypto.createHash("sha256").update(hm1 + r.toString()).digest("hex")
};
