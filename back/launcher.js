const net = require('net'),
    querystring = require('querystring'),
    SocksProxyAgent = require('socks-proxy-agent'),
    c = require('./constants'),
    u = require('./utilities'),
    request = require('./request'),
    accounts = require('./accounts'),
    wss = require('./wss'),
    server = new net.Server().listen(26616),
    serverRetro = new net.Server().listen(26617),
    dofusServer = new net.Server().listen(5555);

dofusServer.on('connection', () => {
    console.log("Si dofus-multi ne fonctionne pas, vous devez setup votre DSN manuellement et désactiver IPV6");
    console.log("Voir tuto dans rubrique Windows 10 sur le lien ci-dessous");
    console.log("https://www.01net.com/astuces/comment-activer-le-dns-cloudflare-pour-accelerer-sa-navigation-web-1411816.html#attachment_862794");
});

server.on('connection', function (socket) {
    let wakfu;
    socket.on('data', async function (data) {
        try {
            const str = data.toString();
            if (str.includes("connect") && (str.includes("dofus") || str.includes("wakfu"))) {
                wakfu = str.includes("wakfu");
                const uuid = str.substring(str.lastIndexOf("$"));
                const token = Buffer.from(uuid, 'utf8').toString('hex');
                if (wakfu) socket.write(Buffer.from("8001000200000007636f6e6e656374000000010b0000000000" + token, "hex"));
                else socket.write(Buffer.from("8001000200000007636f6e6e656374000000000b0000000000" + token, "hex"));
                socket['accountId'] = accounts["uuid" + uuid.substring(1, uuid.length - 1)];
                deletePort(socket, (wakfu ? "wakfu" : "d2") + "Port");
            } else if (str.includes("settings_get")) {
                if (str.includes("autoConnectType")) {
                    socket.write(Buffer.from("800100020000000c73657474696e67735f676574000000000b00000000000322322200", "hex"));
                } else if (str.includes("language")) {
                    socket.write(Buffer.from("800100020000000c73657474696e67735f676574000000000b00000000000422" + Buffer.from(c.language).toString('hex') + "2200", "hex"));
                } else if (str.includes("connectionPort")) {
                    socket.write(Buffer.from("800100020000000c73657474696e67735f676574000000000b00000000000622353535352200", "hex"))
                }
            } else if (str.includes("userInfo_get")) {
                const account = accounts[socket['accountId']];
                const session = account['session']["account"];
                const subscription = account["subscription"];
                const json = JSON.stringify(
                    {
                        "id": session['id'],
                        "type": "ANKAMA",
                        "login": session['login'],
                        "nickname": session['nickname'],
                        "firstname": session['firstname'],
                        "lastname": session['lastname'],
                        "nicknameWithTag": session['nickname'] + "#" + session['tag'],
                        "tag": session['tag'],
                        "security": session['security'] || [],
                        "addedDate": session['added_date'],
                        "locked": "0",
                        "parentEmailStatus": null,
                        "avatar": session['avatar_url'] || null,
                        "isErrored": false,
                        "isMain": true,
                        "active": true,
                        "acceptedTermsVersion": 8,
                        "all": {"CGU": "8", "CGV": "8"},
                        "gameList": [{
                            "isFreeToPlay": false,
                            "isFormerSubscriber": false,
                            "isSubscribed": subscription['subscribed'] || null,
                            "totalPlayTime": subscription['total_time_elapsed'] || null,
                            "endOfSubscribe": subscription['expiration_date'] || null,
                            "id": 1
                        }]
                    }
                );
                let buf = Buffer.from("800100020000000c75736572496e666f5f676574000000000b00000000" + decimalToHex(json.length) + Buffer.from(json, 'utf8').toString('hex') + "00", "hex");
                socket.write(buf)
            } else if (str.includes("auth_getGameToken")) {
                await getGameToken(accounts[socket['accountId']], socket, wakfu ? 3 : 1);
            } else if (str.includes("zaapMustUpdate_get")) {
                socket.write(Buffer.from("80010002000000127a6161704d7573745570646174655f676574000000000200000000", "hex"))
            }
        } catch (e) {
            console.log(e)
        }
    });

});

server.on('error', function (err) {
    console.log(err)
});

serverRetro.on('connection', function (socket) {
    socket.on('data', async function (data) {
        try {
            const str = data.toString().slice(0, -1);
            if (str.startsWith("connect retro main -1")) {
                const split = str.split(" ");
                const uuid = split[split.length - 1];
                socket['accountId'] = accounts["uuid" + uuid];
                socket.write("connected\x00");
                socket.write("connect " + uuid + "\x00");
            } else if (str.startsWith("auth_getGameToken")) {
                await getGameToken(accounts[socket['accountId']], socket, 101);
            }
        } catch (e) {
            console.log(e);
        }
    });

    deletePort(socket, "retroPort");
});

serverRetro.on('error', function (err) {
    console.log(err)
});

function deletePort(socket, port) {
    socket.on('error', function (err) {

    });
    socket.on('end', function () {
        try {
            delete accounts[socket['accountId']][port];
            wss.broadcast({resource: "accounts", key: socket['accountId'], value: accounts[socket['accountId']]});
        } catch (e) {
            console.log(e);
        }
    });
}

function decimalToHex(d) {
    let hex = Number(d).toString(16);
    while (hex.length < 4) hex = "0" + hex;
    return hex;
}

async function getGameToken(account, socket, game) {
    const queryPath = {game, certificate_id: "", certificate_hash: ""};

    if (account['certificate']) {
        queryPath['certificate_id'] = account['certificate']['id'];
        queryPath['certificate_hash'] = u.generateHashFromCertif(account['hm1'], account['certificate']);
    }

    const agent = account['proxy'] ? new SocksProxyAgent(account['proxy']) : null;
    const localAddress = account['localAddress'];
    const APIKEY = account['key'];

    await request(
        {
            agent,
            localAddress,
            path: "/json/Ankama/v5/Api/RefreshApiKey",
            method: 'POST',
            headers: {APIKEY}
        }, "refresh_token=" + account['refresh_token'] + "&long_life_token=true"
    );

    request({
        agent,
        localAddress,
        path: "/json/Ankama/v5/Account/CreateToken?" + querystring.stringify(queryPath),
        method: 'GET',
        headers: {APIKEY}
    }).then(function (json) {
        let buf;
        if (!json?.[1]?.['token']) {
            console.log("impossible de créer le token");
            console.log(json);
            return;
        }
        if (game === 1) {
            buf = Buffer.from("8001000200000011617574685f67657447616d65546f6b656e000000000b000000000024" + Buffer.from(json[1]['token'], 'utf8').toString("hex") + "00", "hex");
        } else if (game === 3) {
            buf = Buffer.from("8001000200000011617574685f67657447616d65546f6b656e000000020b000000000024" + Buffer.from(json[1]['token'], 'utf8').toString("hex") + "00", "hex");
        } else if (game === 101) {
            buf = "auth_getGameToken " + json[1]['token'] + "\x00";
        }
        if (buf) socket.write(buf);
    })
}