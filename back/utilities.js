const fs = require('fs'),
    c = require('./constants'),
    accounts = require('./accounts');

module.exports.wait = function (time) {
    return new Promise(resolve => {
        setTimeout(function () {
            resolve();
        }, time ? time : 10);
    });
};

module.exports.logs = function (...log) {
    if (c.logs) console.log(...log);
};

module.exports.saveAccount = function (account) {
    const toSave = JSON.parse(JSON.stringify(accounts[account]));
    delete toSave['wakfuPort'];
    delete toSave['d2Port'];
    delete toSave['retroPort'];
    fs.writeFileSync("./data/" + account, JSON.stringify(toSave, null, 4));
};
