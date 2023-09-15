const fs = require('fs'),
    os = require('os'),
    path = require('path'),
    {v4: uuidv4} = require('uuid'),
    {stringify} = require('querystring'),
    SocksProxyAgent = require('socks-proxy-agent'),
    u = require('./utilities'),
    wss = require('./wss'),
    accounts = require('./accounts'),
    fake = require('./fake'),
    request = require('./request'),
    flashKey = require('./flashKey'),
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
    const {account, delay, retro} = p.body;
    if (retro && process.platform !== "win32") return p.cb(true, "Retro multi doesn't work yet on linux / mac :(");
    if (delay) await u.wait(delay * 1000);
    const uuid = uuidv4();
    accounts[account].uuid = uuid;
    accounts["uuid" + uuid] = account;
    fake(account, uuid).then(async (res) => {
        if (!res) {
            c.port++;
            const port = 8101 + c.port;
            await dofus.start(accounts[account], port, retro);
            accounts[account][retro ? 'retroPort' : 'd2Port'] = port;
            wss.broadcast({resource: "accounts", key: account, value: accounts[account]});
        }
        p.cb(res !== undefined, res ? "Une erreur est survenue" : "");
    }).catch((e) => {
        console.log(e);
        p.cb(true);
    });
};


function makeid(length) {
    let result = '';
    const characters = 'abcdef0123456789';
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const addedAccounts = {};

router['put-account'] = async (p) => {
    const {login, password, proxy, localAddress} = p.body;
    console.log(login, password);
    const agent = proxy ? new SocksProxyAgent(proxy) : null;
    const result = await request(
        {
            agent,
            localAddress,
            path: "/json/Ankama/v5/Api/CreateApiKey",
            method: 'POST',
            headers: {}
        }, "login=" + login + "&password=" + password + "&game_id=102&long_life_token=true&shop_key=ZAAP&payment_mode=OK&lang=fr&certificate_id=&certificate_hash="
    );
    const [error, json] = result;
    if (error === true) return p.cb(error);
    if (!json['key']) return p.cb(error, "Nom de compte ou mot de passe incorrect");
    if (!json.login) json.login = login;
    const shield = json['data']['security_detail'] === 'CERTIFICATE_MISSING';
    json.flashKey = flashKey();
    if (shield) {
        await request({
            agent,
            localAddress,
            path: "/json/Ankama/v5/Shield/SecurityCode",
            method: 'GET',
            headers: {APIKEY: json['key']}
        });
        addedAccounts[json.accountId] = json;
    } else {
        accounts[login] = json;
        wss.broadcast({resource: "accounts", key: login, value: accounts[login]});
    }
    p.cb(false, {shield})
};

router['post-2fa'] = async (p) => {
    const {login} = p.body;
    const {proxy, localAddress} = addedAccounts[login];
    const agent = proxy ? new SocksProxyAgent(proxy) : null;
    addedAccounts[login]['hm1'] = makeid(32);
    addedAccounts[login]['hm2'] = addedAccounts[login]['hm1'].split("").reverse().join("");
    const result = await request(
        {
            agent,
            localAddress,
            path: "/json/Ankama/v5/Shield/ValidateCode" + stringify({
                game_id: "102",
                code: "",
                hm1: addedAccounts[login]['hm1'],
                hm2: addedAccounts[login]['hm2'],
                name: "launcher-" + login.replace('+', '').replace('@', '').replace('.', ''),
            }),
            method: 'GET',
            headers: {APIKEY: addedAccounts[login]['key']}
        }
    );
    const [error, json] = result;
    if (error === true || !json['encodedCertificate']) return p.cb(error, 'Une erreur est survenue');
    addedAccounts[login]['certificate'] = json;
    addedAccounts[login]['added'] = true;
    accounts[login] = addedAccounts[login];
    u.saveAccount(login);
    p.cb(false)
};

