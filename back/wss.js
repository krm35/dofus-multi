const WebSocket = require('ws');
const wss = new WebSocket.Server({noServer: true});

module.exports.wss = wss;

module.exports.broadcast = function (json, id) {
    try {
        json = JSON.stringify(json);
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    if (id && client['id'] !== id || !id && client['id'] !== undefined) return;
                    client.send(json);
                } catch (e) {
                }
            }
        });
    } catch (e) {

    }
};

const heartbeat = JSON.stringify({hb: 1});

function heartBeat() {
    wss.clients.forEach(client => client.readyState === WebSocket.OPEN && client.send(heartbeat));
    setTimeout(heartBeat, 5000);
}

heartBeat();
