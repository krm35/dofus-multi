const net = require('net'),
    fs = require('fs'),
    path = require('path'),
    frida = require('frida'),
    commons = require('./commons'),
    u = require("./utilities"),
    c = require("./constants");

module.exports.start = async function (account, port, retro) {
    try {
        const server = new net.Server().listen(port);

        server.on('connection', function (socket) {

            let host, port;
            if (!socket['myQueue']) socket['myQueue'] = [];

            socket.on('data', async function (data) {
                try {
                    const s = data.toString();
                    if (s.startsWith('CONNECT')) {
                        const split = s.split(' ')[1].split(':');
                        host = split[0];
                        if (host === "0.0.0.0") host = "127.0.0.1";
                        port = split[1] * 1;
                        if (port === 26117) port = 26617;
                        if (port === 26116) port = 26616;
                        await connectClient(socket, host, port, account);
                    } else {
                        if (!socket.ClientKeyMessage && !retro && port === 5555 && s.endsWith("#01")) {
                            let uid = "";
                            for (let i = s.length - 4; i > 0 && uid.length < 18; i--) uid += s.charAt(i);
                            uid = uid.split("").reverse().join("");
                            if (c.uid.includes(uid)) {
                                socket.ClientKeyMessage = true;
                                // noinspection JSCheckFunctionSignatures
                                data = Buffer.from(data.toString('hex').replace(
                                    Buffer.from(uid).toString('hex'),
                                    Buffer.from(account.flashKey).toString('hex')
                                ), 'hex');
                            }
                        }
                        if (socket['clientSocket']?.['connected']) {
                            socket['clientSocket'].write(data);
                        } else {
                            socket['myQueue'].push(data);
                        }
                    }
                } catch (e) {
                    u.logs(e);
                }
            });

            socket.on('end', function () {
                try {
                    socket['clientSocket'].destroy();
                } catch (e) {

                }
            });

            socket.on('error', function (err) {

            });
        });
        let dofusPath;
        try {
            dofusPath = JSON.parse("" + fs.readFileSync(path.join(c.zaap, "repositories", "production", (retro ? "retro" : "dofus"), "main", "release.json")))['location'];
        } catch (e) {
            dofusPath = path.join(process.env.LOCALAPPDATA, 'Ankama', (1 ? "Retro" : "Dofus"));
        }
        const program = [path.join(dofusPath, (retro ? "Dofus Retro" : "Dofus") + ".exe")];
        if (!retro) {
            program.push("--port=26116");
            program.push("--gameName=dofus");
            program.push("--gameRelease=main");
            program.push("--instanceId=1");
            program.push("--hash=" + account.uuid);
            program.push("--canLogin=true");
        }
        const pid = await frida.spawn(program, {
            env: retro ? {
                ZAAP_CAN_AUTH: true,
                ZAAP_GAME: "retro",
                ZAAP_HASH: account.uuid,
                ZAAP_LOGS_PATH: path.join(c.zaap, "retro"),
                ZAAP_INSTANCE_ID: "1",
                ZAAP_RELEASE: "main"
            } : {}
        });
        await loadScript(pid, port, retro, account, true);
        return pid;
    } catch (e) {
        console.log(e);
    }
};

async function loadScript(pid, port, retro, account, resume) {
    const session = await frida.attach(pid);
    const script = await session.createScript(getSource(port, retro, account));
    await script.load();
    if (resume) {
        retro && script.message.connect(message => loadScript(message.payload, port, true, account));
        await frida.resume(pid);
    }
}

async function connectClient(socket, host, port, account) {
    u.logs("connection", host + ":" + port);

    socket['clientSocket'] = new net.Socket();

    await commons.connectClient(socket, host, port, account);

    socket['clientSocket'].on('data', function (data) {
        u.logs("from", host + ':' + port, data.toString());
        socket.write(data);
    });

    socket['clientSocket'].on('close', function () {
        socket.destroy();
    });

    socket['clientSocket'].on('error', function (err) {
    });
}

function getSource(port, retro, account) {
    return `
        try{
        const isRetro = ${retro};
        var connect_p = Module.getExportByName(null, 'connect');
        var send_p = Module.getExportByName(null, 'send');
        // ssize_t send(int sockfd, const void * buf, size_t len, int flags);
        var socket_send = new NativeFunction(send_p, 'int', ['int', 'pointer', 'int', 'int']);
        var recv_p = Module.getExportByName(null, 'recv');
        // ssize_t recv(int sockfd, void *buf, size_t len, int flags);
        var socket_recv = new NativeFunction(recv_p, 'int', ['int', 'pointer', 'int', 'int']);
        Interceptor.attach(connect_p, {
            onEnter: function (args) {
                // int connect(int sockfd, const struct sockaddr *addr,
                //             socklen_t addrlen);
                this.sockfd = args[0];
                var sockaddr_p = args[1];
                this.port = 256 * sockaddr_p.add(2).readU8() + sockaddr_p.add(3).readU8();
                this.addr = "";
                for (var i = 0; i < 4; i++) {
                    this.addr += sockaddr_p.add(4 + i).readU8(4);
                    if (i < 3) this.addr += '.';
                }
                if(isRetro && this.port === 80) return;
                var newport = ${port};
                sockaddr_p.add(2).writeByteArray([Math.floor(newport / 256), newport % 256]);
                sockaddr_p.add(4).writeByteArray([127, 0, 0, 1]);
            },
            onLeave: function (retval) {
                var connect_request = "CONNECT " + this.addr + ":" + this.port + " HTTP/1.0 ";
                var buf_send = Memory.allocUtf8String(connect_request);
                socket_send(this.sockfd.toInt32(), buf_send, connect_request.length, 0);
            }
        });

        if(isRetro){
        
            let pointer = {};
        
            function changeValue(method) {
                for (let p in pointer) {
                    try {
                        pointer[p][method]("DESKTOP-"+"${account['refreshToken'].split('-')[0].substr(0, 7).toUpperCase()}" + String.fromCharCode(0));
                        delete pointer[p];
                    } catch (e) {
                    }
                }
            }
            
            Interceptor.attach(Module.getExportByName(null, 'gethostname'), {
                onEnter: (args) => pointer[args[0]] = ptr(args[0]),
                onLeave: () => changeValue("writeAnsiString")
            });

            Interceptor.attach(Module.getExportByName(null, 'GetHostNameW'), {
                onEnter: (args) => pointer = ptr(args[0]),
                onLeave: () => changeValue("writeUtf16String")
            });
            
            Interceptor.attach(Module.getExportByName(null, 'CreateProcessW'), {
                onEnter: (args) => {
                    const command = Memory.readUtf16String(args[0]);
                    const type = Memory.readUtf16String(args[1]);
                    if (!command) {
                        if (type.includes("network") || type.includes("plugins")) this.pid = args[9];
                    }
                }, onLeave: () => {
                    if (this.pid) {
                        send(parseInt(this.pid.add(Process.pointerSize * 2).readInt()));
                        delete this.pid;
                    }
                }
            });
        
        }
        }catch(e){
            console.log(e);
        }
`;
}