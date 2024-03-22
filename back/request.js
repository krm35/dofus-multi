const https = require('https'),
    zlib = require("zlib"),
    c = require("./constants");

module.exports = function request(options, body, hostname) {

    options.headers = {
        'accept': '*/*',
        'accept-encoding': 'gzip,deflate',
        'accept-language': 'fr',
        'connection': 'close',
        'user-agent': 'Zaap ' + c.version,
        ...(options.headers || {})
    };

    if (options.localAddress) delete options.agent;

    if (body) {
        options.headers["content-length"] = body.length;
        if (!options.headers["content-type"]) options.headers["content-type"] = "text/plain;charset=UTF-8";
    }

    return new Promise((resolve) => {
        let data = "", buffer = [];

        const req = https.request({
            hostname: hostname || 'haapi.ankama.com',
            port: 443,
            ...options
        }, function (res) {
            // console.log(res.statusCode);
            if (res.headers['content-encoding'] === 'gzip') {
                const gunzip = zlib.createGunzip();
                res.pipe(gunzip);

                gunzip.on('data', function (data) {
                    buffer.push(data.toString())
                }).on("end", function () {
                    let json;
                    try {
                        json = JSON.parse(buffer.join(""))
                    } catch (e) {
                        // console.log(e);
                    }
                    resolve([false, json || buffer.join(""), res.headers]);
                }).on('error', () => {
                    resolve([true]);
                })
            } else {
                res.on('data', (chunk => {
                    data += chunk;
                }));
                res.on('end', () => {
                    try {
                        resolve([false, JSON.parse(data), res.headers]);
                    } catch (e) {
                        resolve([false, data.toString(), res.headers]);
                    }
                });
                res.on('error', () => {
                    resolve([true]);
                })
            }
        }).on('error', (err) => {
            console.log(err);
            resolve([true, "error"]);
        });
        if (body) req.write(body);
        req.end();
    });
};