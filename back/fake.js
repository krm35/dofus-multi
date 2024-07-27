const SocksProxyAgent = require('socks-proxy-agent'),
    request = require('./request'),
    u = require('./utilities'),
    accounts = require('./accounts');

module.exports = async (account, uuid) => {
    if (accounts[account]['certificate']) {
        try {
            u.generateHashFromCertif(accounts[account]['hm1'], accounts[account]['certificate']);
        } catch {
            u.deleteAccount(account);
            return "account expired";
        }
    }
    const localAddress = accounts[account]['localAddress'] || null;
    let result;
    const key = accounts[account]['key'];
    result = await SignOnWithApiKey(key, localAddress, getAgent(account));
    if (checkError(result)) return result[1];
    const session = result[1];
    if (!session['account']) {
        u.deleteAccount(account);
        return "account expired";
    }
    result = await ListWithApiKey(key, localAddress, getAgent(account));
    if (checkError(result)) return result[1];
    const subscription = result[1][0] || {};
    if (checkError(result)) return result[1];
    await RefreshApiKey(key, accounts[account]['refreshToken'], localAddress, getAgent(account));
    result = await CreateToken(key, localAddress, getAgent(account));
    if (checkError(result)) return result[1];
    accounts[account] = {
        uuid,
        sessionId: session["id"],
        APIKEY: key,
        accountId: session['account']['id'],
        session,
        subscription,
        ...accounts[account],
    };
};

function getAgent(account) {
    return accounts[account]['proxy'] ? new SocksProxyAgent(accounts[account]['proxy']) : null;
}

function checkError(result) {
    if (result[0] === true) {
        return result[1];
    }
}

async function SignOnWithApiKey(key, localAddress, agent) {
    return request(
        {
            agent,
            localAddress,
            path: "/json/Ankama/v5/Account/SignOnWithApiKey",
            method: 'POST',
            headers: {APIKEY: key}
        }, "game=102"
    );
}

async function ListWithApiKey(key, localAddress, agent) {
    return request(
        {
            agent,
            localAddress,
            path: "/json/Ankama/v5/Game/ListWithApiKey",
            method: 'GET',
            headers: {APIKEY: key}
        }
    );
}

async function RefreshApiKey(key, token, localAddress, agent) {
    return request(
        {
            agent,
            localAddress,
            path: "/json/Ankama/v5/Api/RefreshApiKey",
            method: 'POST',
            headers: {APIKEY: key}
        }, "refresh_token=" + token + "&long_life_token=true"
    );
}

async function CreateToken(key, localAddress, agent) {
    return request(
        {
            agent,
            localAddress,
            path: "/json/Ankama/v5/Account/CreateToken?game=99&certificate_id=&certificate_hash=",
            method: 'GET',
            headers: {APIKEY: key}
        }
    );
}