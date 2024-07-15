const fs = require('fs'),
    os = require('os'),
    path = require('path'),
    crypto = require('crypto'),
    {stringify} = require('querystring'),
    dns = require('dns'),
    child_process = require('child_process'),
    {v4: uuidv4} = require('uuid'),
    SocksProxyAgent = require('socks-proxy-agent'),
    u = require('./utilities'),
    accounts = require('./accounts'),
    fake = require('./fake'),
    request = require('./request'),
    flashKey = require('./flashKey'),
    c = require('./constants'),
    router = {};

module.exports = router;

router['files'] = {};

let retroCdn;

dns.lookup('dofusretro.cdn.ankama.com', (err, addresses) => {
    addresses = addresses.split('.');
    addresses.length -= 1;
    retroCdn = addresses.join('.');
});

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

router['delete-account'] = async (p) => {
    const {account} = p.body;
    u.deleteAccount(account);
    u.broadcast(account);
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
    u.broadcast(accountId);
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
                let dofusProcess;
                dofusProcess = child_process.spawn(process.argv[0], [process.argv[1], "launchAccount", stringify({
                    account: JSON.stringify(accounts[account]),
                    port,
                    type,
                    retroCdn
                })]);
                dofusProcess.stdout.on('data', (data) => console.log(data.toString()));
                dofusProcess.stderr.on('data', (data) => console.log(data.toString()));
            } catch (e) {
                console.log(e);
                return p.cb(true, e === "EAC" ? "Easy anti-cheat not handled yet" : "Une erreur est survenue");
            }
            accounts[account][(type === 1 ? 'retro' : type === 2 ? 'd2' : 'wakfu') + 'Port'] = port;
        }
        u.broadcast(account);
        p.cb(res !== undefined, res || "");
    }).catch((e) => {
        console.log(e);
        p.cb(true, "Une erreur est survenue");
    });
};

function generateCodeVerifier() {
    const e = Math.floor(85 * Math.random() + 43),
        t = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    let n = "";
    for (let r = 0; r < e; r++) n += t[Math.floor(Math.random() * t.length)];
    return n
}

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

const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "fr,fr-FR;q=0.8,en-US;q=0.5,en;q=0.3",
    "content-type": "application/x-www-form-urlencoded",
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-User": "?1",
    "Pragma": "no-cache",
    "Cache-Control": "no-cache"
};

router['put-account'] = async (p) => {
    if (p.body.proxy) p.body.localAddress = null;
    const {login, password, proxy, localAddress, alias} = p.body;
    const agent = proxy ? new SocksProxyAgent(proxy) : null;
    const codeVerifier = generateCodeVerifier();
    const code_challenge = crypto.createHash("sha256").update(codeVerifier).digest("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");

    let result, location;

    result = await request(
        {
            agent, localAddress, method: 'GET', headers,
            path: `/login/ankama?code_challenge=${code_challenge}&redirect_uri=zaap://login&client_id=102&direct=true&origin_tracker=https://www.ankama-launcher.com/launcher`
        },
        null,
        "auth.ankama.com"
    );

    ({location} = result[2] || {});
    if (!location) return p.cb(true);

    result = await request(
        {agent, localAddress, path: location, method: 'GET', headers},
        null,
        "auth.ankama.com"
    );

    const state = result[1].split('<input type="hidden" name="state" value="')[1].split('"')[0];

    result = await request(
        {agent, localAddress, path: "/login/ankama/form", method: 'POST', headers},
        stringify({login, password, state}),
        "auth.ankama.com"
    );

    ({location} = result[2] || {});
    if (!location) return p.cb(true, "Incorrect login or password");

    result = await request(
        {agent, localAddress, path: location, method: 'GET', headers},
        null,
        "auth.ankama.com"
    );

    const code = result[1].split('login?code=')[1].split('"')[0];

    result = await request({agent, localAddress, path: "/token", method: 'POST', headers},
        stringify({
            grant_type: "authorization_code",
            code,
            redirect_uri: "zaap://login",
            client_id: 102,
            code_verifier: codeVerifier
        }),
        "auth.ankama.com"
    );

    if (!result?.[1]?.['access_token']) return p.cb(true);

    const APIKEY = result[1]['access_token'], refreshToken = result[1]['refresh_token'];

    result = await request(
        {
            localAddress,
            agent,
            path: "/json/Ankama/v5/Account/Account",
            method: 'GET',
            headers: {APIKEY}
        }
    );

    const [error, json] = result;
    if (error || !json?.['id']) return p.cb(true);
    const {id} = json;
    json.key = APIKEY;
    json.refreshToken = refreshToken;
    json.flashKey = flashKey();
    json.proxy = proxy;
    json.localAddress = localAddress;
    json.alias = alias;
    json.accountId = id;
    json.added = true;
    json.wakfuInterface = Object.keys(accounts).length;
    const shield = json['security']?.includes("SHIELD");
    if (shield) {
        await request({
            agent,
            localAddress,
            path: "/json/Ankama/v5/Shield/SecurityCode?transportType=EMAIL",
            method: 'GET',
            headers: {APIKEY}
        });
        addedAccounts[login] = json;
    } else {
        accounts[id] = json;
        u.broadcast(id);
        u.saveAccount(id);
    }
    p.cb(false, {shield})
};

router['post-shield'] = async (p) => {
    if (p.body.proxy) p.body.localAddress = null;
    const {login, code, proxy, localAddress} = p.body;
    const agent = proxy ? new SocksProxyAgent(proxy) : null;
    const hm1 = makeid(32);
    const hm2 = hm1.split("").reverse().join("");
    addedAccounts[login].hm1 = hm1;
    addedAccounts[login].hm2 = hm2;
    const result = await request(
        {
            agent,
            localAddress,
            path: "/json/Ankama/v5/Shield/ValidateCode?" + stringify({
                game_id: "102",
                code,
                hm1,
                hm2,
                name: "launcher-" + login.replace('+', '').replace('@', '').replace('.', ''),
            }),
            method: 'GET',
            headers: {APIKEY: addedAccounts[login]['key']}
        }
    );
    const [error, json] = result;
    if (error === true || !json['encodedCertificate']) return p.cb(true);
    addedAccounts[login].certificate = json;
    const {id} = addedAccounts[login];
    accounts[id] = addedAccounts[login];
    u.broadcast(id);
    u.saveAccount(id);
    p.cb(false, "Account added");
};
