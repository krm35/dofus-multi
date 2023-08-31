import React, {useEffect, useState} from "react";
import {Button, Dialog, HTMLSelect, HTMLTable, InputGroup} from "@blueprintjs/core";
import * as Classes from "@blueprintjs/core/lib/cjs/common/classes";

export default function (props) {

    const [interfaces, setInterfaces] = useState([]);
    const [data, setData] = useState({});

    function trigger(action, resource, body, setter) {
        const id = Date.now() + resource;
        window.map[id] = (a) => setter(a);
        window.ws.send(JSON.stringify({id, body, action, resource}));
    }

    useEffect(() => {
        if (!props.account) return;
        trigger("get", "interfaces", null, setInterfaces);
        trigger("get", "account", {login: props.account['accountId']}, setData)
    }, [props.account]);

    if (!props.account || !data) return;

    function updateAccount(body) {
        const id = Date.now();
        window.ws.send(JSON.stringify({
            id,
            body,
            action: "post",
            resource: "account"
        }));
    }

    function getTitle() {
        return props.account['login'];
    }

    return (
        <Dialog
            style={{width: "40%"}}
            icon="info-sign"
            title={getTitle()}
            isOpen={props.account}
            onClose={() => props.setAccount(null)}
        >
            <div className={Classes.DIALOG_BODY}>

                <HTMLTable condensed bordered style={{marginTop: "5px", marginBottom: "5px", width: '100%'}}>
                    <thead>
                    <tr>
                        <th width="30%">Paramètre</th>
                        <th width="70%">Valeur</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>Alias</td>
                        <td>
                            <InputGroup
                                onChange={(e) => setData({...data, alias: e.target.value})}
                                value={data?.alias ?? ""}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Adresse IP</td>
                        <td>
                            <HTMLSelect
                                onChange={(event) => {
                                    const value = event.currentTarget.value;
                                    if ("IP par défaut" === value) {
                                        setData({...data, proxy: null, localAddress: null})
                                    } else if ("Proxy" === value) {
                                        if (!data.proxy) data.proxy = {};
                                        setData({...data})
                                    } else {
                                        setData({
                                            ...data,
                                            proxy: null,
                                            localAddress: value
                                        })
                                    }
                                }}
                            >
                                <option selected={!data.proxy && !data.localAddress}>IP par défaut</option>
                                {interfaces.map(({name, _interface}) =>
                                    <option
                                        selected={data.localAddress === _interface.address}
                                        key={_interface.address}
                                        value={_interface.address}
                                    >
                                        {name + ": " + _interface.address}
                                    </option>
                                )}
                                <option selected={data.proxy}>Proxy</option>
                            </HTMLSelect>
                        </td>
                    </tr>
                    {data.proxy && [['IP', 'hostname'], ['Port', 'port'], ['Username', 'userId'], ['Password', 'password']]
                        .map(([label, prop], i) =>
                            <tr key={i}>
                                <td>Proxy {label}</td>
                                <td>
                                    <InputGroup
                                        onChange={(e) => {
                                            data.proxy[prop] = e.target.value;
                                            setData({...data});
                                        }}
                                        value={data?.proxy?.[prop] ?? ""}
                                    />
                                </td>
                            </tr>
                        )}
                    </tbody>
                </HTMLTable>

            </div>
            <div className={Classes.DIALOG_FOOTER}>
                <div className={Classes.DIALOG_FOOTER_ACTIONS}>
                    <Button intent="primary" onClick={() => {
                        updateAccount(data);
                        props.setAccount(null);
                    }}>Sauvegarder les changements</Button>
                </div>
            </div>
        </Dialog>
    )
}