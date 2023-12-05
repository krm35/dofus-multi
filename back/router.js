const fs = require('fs'),
    os = require('os'),
    path = require('path'),
    {v4: uuidv4} = require('uuid'),
    u = require('./utilities'),
    wss = require('./wss'),
    fake = require('./fake'),
    accounts = require('./accounts'),
    c = require('./constants'),
    dofus = require('./dofus'),
    router = {};

module.exports = router;

router['files'] = {};

function loadFiles(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    for (let f in files) {
        const filePath = path.join(dirPath, files[f]);
        if (fs.lstatSync(filePath).isDirectory()) loadFiles(filePath + "/");
        else router['files'][files[f]] = fs.readFileSync(filePath);
    }
}

loadFiles(path.join(__dirname, './build'));

function getInterfaces() {
    const interfaces = os.networkInterfaces();
    const res = [];
    Object.keys(interfaces).forEach(function (name) {
        if (name.toLowerCase().includes("vmware") || name.toLowerCase().includes("virtual") || name.toLowerCase().includes("qemu")) return;
        interfaces[name].forEach(function (_interface) {
            if (_interface.family === 'IPv4') res.push({name, _interface});
        });
    });
    return res;
}

getInterfaces();

router['get-interfaces'] = async (p) => {
    p.cb(false, getInterfaces())
};

router['get-account'] = async (p) => {
    p.cb(false, accounts[p.body.login])
};

router['get-accounts'] = async (p) => {
    p.cb(false, accounts)
};

router['post-account'] = async (p) => {
    const {accountId} = p.body;
    if (!accounts[accountId].added) {
        delete p.body['key'];
        delete p.body['refreshToken'];
    }
    if (p.body.proxy) p.body.localAddress = null;
    accounts[accountId] = {...accounts[accountId], ...p.body};
    u.saveAccount(accountId);
    wss.broadcast({resource: "accounts", key: accountId, value: accounts[accountId]});
    p.cb(false)
};

router['get-connect'] = async (p) => {
    const {account, delay, type} = p.body;
    if (type === 1 && process.platform !== "win32") return p.cb(true, "Retro multi doesn't work yet on linux / mac :(");
    if (type === 3 && process.platform !== "win32") return p.cb(true, "Wakfu multi will soon work on linux / mac :)");
    if (type === 3 && !accounts[account].wakfuInterface) return p.cb(true, "Need to choose a network interface");
    if (delay) await u.wait(delay * 1000);
    const uuid = uuidv4();
    accounts[account].uuid = uuid;
    accounts["uuid" + uuid] = account;
    fake(account, uuid).then(async (res) => {
        if (!res) {
            c.port++;
            const port = 8101 + c.port;
            try {
                await dofus.start(accounts[account], port, type);
            } catch (e) {
                return p.cb(true, e === "EAC" ? "Easy anti-cheat not handled yet" : "Une erreur est survenue");
            }
            accounts[account][(type === 1 ? 'retro' : type === 2 ? 'd2' : 'wakfu') + 'Port'] = port;
            wss.broadcast({resource: "accounts", key: account, value: accounts[account]});
        }
        p.cb(res !== undefined, res || "");
    }).catch((e) => {
        console.log(e);
        p.cb(true, "Une erreur est survenue");
    });
};