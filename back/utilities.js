const fs = require('fs'),
    c = require('./constants'),
    accounts = require('./accounts');

module.exports.wait = (time) => new Promise(resolve => setTimeout(resolve, time ? time : 10));

module.exports.logs = (...log) => c.logs && console.log(...log);

module.exports.saveAccount = function (account) {
    const toSave = JSON.parse(JSON.stringify(accounts[account]));
    delete toSave['wakfuPort'];
    delete toSave['d2Port'];
    delete toSave['retroPort'];
    fs.writeFileSync("./data/" + account, JSON.stringify(toSave, null, 4));
};
