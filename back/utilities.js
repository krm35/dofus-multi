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
    fs.writeFileSync("./data/" + account, JSON.stringify(accounts[account], null, 4));
};
