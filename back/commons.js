const {SocksClient} = require('socks');

module.exports.connectClient = async function connectClient(socket, host, port, account) {
    if (host === "127.0.0.1" || host === "0.0.0.0") {
        socket['clientSocket'].connect({host, port});
    } else {
        if (account.proxy) {
            socket['clientSocket'] = await getSocket(host, port, account);
            socket['clientSocket']['connected'] = true;
            sendQueue(socket)
        } else {
            socket['clientSocket'].connect({
                host,
                port,
                localAddress: account.localAddress || null
            });
        }
    }
    socket['clientSocket'].on('connect', function () {
        socket['clientSocket']['connected'] = true;
        sendQueue(socket);
    });
};

function sendQueue(socket) {
    socket['myQueue'].forEach(packet => {
        socket['clientSocket'].write(packet)
    });
    socket['myQueue'].length = 0;
}

function getSocket(host, port, account) {
    return new Promise(resolve => {
        SocksClient.createConnection({
            proxy: {
                ...account.proxy,
                host: account.proxy.hostname,
                port: Number(account.proxy.port),
                type: 5
            },
            command: 'connect',
            destination: {host, port}
        }).then(info => resolve(info.socket))
    });
}