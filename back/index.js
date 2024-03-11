process.on('uncaughtException', function (err) {
    console.log('uncaughtException', err);
});

const http = require('http'),
    fs = require('fs'),
    path = require('path'),
    {execSync} = require('child_process'),
    {v4: uuidv4} = require('uuid'),
    router = require('./router'),
    accounts = require('./accounts'),
    request = require('./request'),
    constants = require('./constants'),
    {wss} = require('./wss');

require('./launcher');

if (process.platform === "win32") {
    const tempPath = path.join(process.env.LOCALAPPDATA, 'Temp');
    fs.existsSync(tempPath) && fs.readdirSync(tempPath).filter(f => f.includes("frida")).forEach(f => fs.rmSync(tempPath + "\\" + f, {
        recursive: true,
        force: true
    }));
}

const server = http.createServer(
    function (req,
              res) {
        const fileName = path.basename(req.url).split('?')[0] || "index.html";
        res.end(router['files'][fileName] || router['files']["index.html"]);
    }).listen(8080);

server.on('upgrade', function upgrade(request, socket, head) {
    wss['handleUpgrade'](request, socket, head, function done(ws) {
        wss['emit']('connection', ws, request);
        ws.send(JSON.stringify(["accounts", accounts]))
    });
});

wss['on']('connection', function connection(ws) {
    ws.send(JSON.stringify({id: "version", data: constants.version !== newVersion}));
    ws.on('message', async function message(message) {
        try {
            const json = JSON.parse(message);
            const {action, resource, body, id} = {...json};
            if (!router[action + '-' + resource]) return;
            router[action + '-' + resource]({
                body, ws, cb: function (error, data, trigger) {
                    ws.send(JSON.stringify({error, data, id, trigger}));
                }
            }).catch((e) => {
                console.log(e);
                ws.send(JSON.stringify({error: true, id}));
            });
        } catch (e) {
            console.log(e);
        }
    });
});

let newVersion = null;

if (!process.argv.includes("dev=true")) {
    (async () => {
        const [, version] = await request(
            {
                path: "/installers/production/latest.yml?noCache=" + Date.now().toString(32),
                method: 'GET',
                headers: {
                    'accept': '*/*',
                    'accept-encoding': 'gzip, deflate, br',
                    'accept-language': 'fr',
                    'cache-control': 'no-cache',
                    'connection': 'keep-alive',
                    'sec-fetch-mode': 'no-cors',
                    'sec-fetch-site': 'none',
                    'user-agent': 'electron-builder',
                    'x-user-staging-id': uuidv4()
                }
            }, null, "launcher.cdn.ankama.com"
        );
        newVersion = version['split']('\n')[0].split(' ')[1];
        process.platform === "win32" && execSync('start "" http://localhost:8080');
    })();
}