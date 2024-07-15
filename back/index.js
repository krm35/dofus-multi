process.on('uncaughtException', function (err) {
    if (err.message.includes("EADDRINUSE")) return console.log("\n\nServer already launched\n\n".toUpperCase());
    console.log('uncaughtException', err);
});

const c = require('./constants');

if (process.argv.includes("launchAccount")) {
    return require('./dofus');
}

const http = require('http'),
    fs = require('fs'),
    path = require('path'),
    {execSync} = require('child_process'),
    {v4: uuidv4} = require('uuid'),
    router = require('./router'),
    accounts = require('./accounts'),
    request = require('./request'),
    {wss} = require('./wss');

require('./launcher');

if (process.platform === "win32") {
    const tempPath = path.join(process.env.LOCALAPPDATA, 'Temp');
    fs.existsSync(tempPath) && fs.readdirSync(tempPath).filter(f => f.includes("frida"))
        .forEach(f => fs.rmSync(path.join(tempPath, f), {recursive: true, force: true}));
}

const extensions = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".csv": "text/csv",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ttf": "font/font-sfnt",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".cur": "image/x-icon",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".json": "application/json",
    ".pdf": "application/pdf",
};

const server = http.createServer(
    function (req,
              res) {
        let fileName = path.basename(req.url).split('?')[0] || "index.html";
        if (!extensions[path.extname(fileName)]) fileName = "index.html";
        res.setHeader("Content-Type", extensions[path.extname(fileName)]);
        res.end(router['files'][fileName]);
    }).listen(8081);

server.on('upgrade', function upgrade(request, socket, head) {
    wss['handleUpgrade'](request, socket, head, function done(ws) {
        wss['emit']('connection', ws, request);
        ws.send(JSON.stringify(["accounts", accounts]))
    });
});

wss['on']('connection', function connection(ws) {
    ws.send(JSON.stringify({id: "version", data: c.version !== newVersion}));
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

if (!c.isTest) {
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
        process.platform === "win32" && execSync('start "" http://localhost:8081');
    })();
}