import Toaster from "./Toaster";

export function initWS() {
    if (window.ws) return;
    const ws = new WebSocket('ws://localhost:8080/');

    ws.onopen = function () {
        console.log("open");
    };

    ws.onmessage = function (e) {
        try {
            const json = JSON.parse(e.data);
            if (!json.hb) {
                console.log(json);
                if (json.error) {
                    Toaster.show({message: json.data, intent: "danger"});
                } else if (Array.isArray(json)) {
                    const [key, value] = json;
                    if (key === "accounts") window.setAccounts(value);
                } else if (json.resource) {
                    const {resource, key, value} = json;
                    if (resource === "accounts") {
                        window.accounts[key] = value;
                        window.setAccounts({...window.accounts});
                    }
                } else if (json.id) {
                    window.map[json.id]?.(json.data)
                }
            }
        } catch (e) {
            console.log(e);
        }
    };

    ws.onerror = function (e) {
    };

    ws.onclose = function () {
        delete window.ws;
        setTimeout(initWS, 5000);
    };

    window.ws = ws;
}
