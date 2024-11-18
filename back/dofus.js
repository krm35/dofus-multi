const net = require('net'),
    fs = require('fs'),
    dns = require('dns'),
    path = require('path'),
    querystring = require('querystring'),
    {spawn} = require('child_process'),
    frida = require('frida'),
    ByteArray = require('bytearray-node'),
    payloadWriter = require('./payloadWriter'),
    commons = require('./commons'),
    u = require("./utilities"),
    c = require("./constants");

const start = async function (account, port, type) {

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
                    const msgId = data.readUInt16BE(0) >> 2;
                    if (type === 2 && port === 5555 && msgId === 7975) {
                        const buff = new ByteArray(Buffer.from(data.toString('hex'), "hex"));
                        buff.position = 0;
                        buff.readShort();
                        const packetCounter = buff.readUnsignedInt();
                        const ClientKeyMessage = new ByteArray();
                        ClientKeyMessage.writeUTF(account.flashKey + "#01");
                        data = Buffer.from(payloadWriter(new ByteArray(), msgId, ClientKeyMessage, packetCounter).toString('hex'), 'hex');
                    }
                    if (socket['clientSocket']?.['connected']) socket['clientSocket'].write(data);
                    else socket['myQueue'].push(data);
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
        dofusPath = JSON.parse("" + fs.readFileSync(path.join(c.zaap, "repositories", "production", (type === 1 ? "retro" : type === 2 ? "dofus" : "wakfu"), "main", "release.json")))['location'];
        if (typeof dofusPath !== "string" || !fs.existsSync(dofusPath)) throw new Error("not a good path");
    } catch (e) {
        dofusPath = path.join(process.env.LOCALAPPDATA, 'Ankama', (type === 1 ? "Retro" : type === 2 ? "Dofus" : "Wakfu"));
    }

    const files = fs.readdirSync(dofusPath);
    files.forEach(f => {
        if ([
            "start_protected_game.exe",
            "EOSSDK-Win64-Shipping.dll",
            "EasyAntiCheat"
        ].includes(f)) {
            throw "EAC";
        }
    });
    //C:\Windows\system32\cmd.exe /c zaap-start.bat fr 2G 2G "-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -Djava.net.preferIPv4Stack=true -Dsun.awt.noerasebackground=true -Dsun.java2d.noddraw=true -Djogl.disable.openglarbcontext" default natives/ NUL false
    const program = [type === 3 ? path.join('C:', 'Windows', 'system32', 'cmd.exe') : path.join(dofusPath, (type === 1 ? "Dofus Retro" : "Dofus") + ".exe")];
    if (type === 2) {
        program.push("--port=26116");
        program.push("--gameName=dofus");
        program.push("--gameRelease=main");
        program.push("--instanceId=1");
        program.push("--hash=" + account.uuid);
        program.push("--canLogin=true");
    } else if (type === 3) {
        program.length = 0;
        program.push("/c");
        program.push(path.join(dofusPath, "zaap-start.bat"));
        program.push("fr");
        program.push("2G");
        program.push("4G");
        program.push("-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -Djava.net.preferIPv4Stack=true -Dsun.awt.noerasebackground=true -Dsun.java2d.noddraw=true -Djogl.disable.openglarbcontext");
        program.push("default");
        program.push("natives/");
        program.push("NUL");
        program.push("false");
        const pp = spawn(path.join('C:', 'Windows', 'system32', 'cmd.exe'), program, {
            cwd: dofusPath,
            env: {
                ZAAP_CAN_AUTH: true,
                ZAAP_GAME: "wakfu",
                ZAAP_HASH: account.uuid,
                ZAAP_LOGS_PATH: path.join(c.zaap, "gamesLogs", "wakfu"),
                ZAAP_INSTANCE_ID: "1",
                ZAAP_RELEASE: "main"
            }
        });
        let pid;
        while (isNaN(Number(pid))) {
            pid = await hookWakfu(pp.pid);
            await u.wait(1000);
        }
        return await loadScript(pid, port, type, account);
    }
    const pid = await frida.spawn(program, {
        env: type === 1 ? {
            ZAAP_CAN_AUTH: true,
            ZAAP_GAME: "retro",
            ZAAP_HASH: account.uuid,
            ZAAP_LOGS_PATH: path.join(c.zaap, "retro"),
            ZAAP_INSTANCE_ID: "1",
            ZAAP_RELEASE: "main"
        } : {}
    });
    await loadScript(pid, port, type, account, true);
};

module.exports.start = start;

function hookWakfu(pid) {
    return new Promise(resolve => {
        const dofusProcess = require("child_process").spawn(
            "WMIC",
            ["path", "win32_process", "where", "(ParentProcessId=" + pid + ")", "get", "Processid"]
        );
        let data = "";
        dofusProcess.stdout.on('data', (chunk) => data += chunk);
        dofusProcess.on('exit', () => resolve(parseInt(data.split('\r\n')[1])));
    });
}

async function loadScript(pid, port, type, account, resume) {
    const session = await frida.attach(pid);
    const script = await session.createScript(getSource(port, type, account));
    await script.load();
    if (resume) {
        type === 1 && script.message.connect(message => loadScript(message.payload, port, type, account));
        await frida.resume(pid);
    }
}

async function connectClient(socket, host, port, account) {

    socket['clientSocket'] = new net.Socket();

    await commons.connectClient(socket, host, port, account);

    socket['clientSocket'].on('data', function (data) {
        socket.write(data);
    });

    socket['clientSocket'].on('close', function () {
        socket.destroy();
    });

    socket['clientSocket'].on('error', function (err) {
    });
}

let retroCdn = "";

function getSource(port, type, account) {
    return `
        try{
        const isRetro = ${type === 1};
        const isWakfu = ${type === 3};
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
                if(isRetro && ${retroCdn}.includes(this.addr)) return;
                if(isWakfu && this.port > 40000) return;
                var newport = ${port};
                sockaddr_p.add(2).writeByteArray([Math.floor(newport / 256), newport % 256]);
                sockaddr_p.add(4).writeByteArray([127, 0, 0, 1]);
                this.shouldSend = true
            },
            onLeave: function (retval) {
                var connect_request = "CONNECT " + this.addr + ":" + this.port + " HTTP/1.0 ";
                var buf_send = Memory.allocUtf8String(connect_request);
                this.shouldSend && socket_send(this.sockfd.toInt32(), buf_send, connect_request.length, 0);
            }
        });
        
        if(isWakfu){
            const getMacAddrPtr = Module.getExportByName(null, 'Java_java_net_NetworkInterface_getMacAddr0');
            const array =  ['pointer', 'pointer', 'pointer', 'pointer', 'pointer'];
            const getMacAddr = new NativeFunction(getMacAddrPtr, 'pointer', array);
            Interceptor.replace(getMacAddrPtr, new NativeCallback((_env, _class, _addrArray, _name, _index) => {
              let result, good = 0;
              for(let i = 0; i < 100; i++){
                 result = getMacAddr(_env, _class, _addrArray, _name, ptr("0x"+i));
                 if(result != 0x0){
                    good++;
                    if(good == ${account['wakfuInterface']}) break;
                 }
              }
              return result;
            }, 'pointer', array));
        }

        if(isRetro || isWakfu){
        
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
                onEnter: (args) => pointer[args[0]] = ptr(args[0]),
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


(async () => {
    if (process.argv.includes("launchAccount")) {
        const body = querystring.parse(process.argv[process.argv.length - 1]);
        const {port, type} = body;
        const account = JSON.parse(body.account);
        dns.resolve('dofusretro.cdn.ankama.com', async (err, addresses) => {
            retroCdn = JSON.stringify(addresses);
            await start(account, port, Number(type));
        });
    }
})();