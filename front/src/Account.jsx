import React, {useEffect, useState} from "react";
import {Alert, Button, Callout, Dialog, FormGroup, HTMLSelect, HTMLTable, InputGroup} from "@blueprintjs/core";
import * as Classes from "@blueprintjs/core/lib/cjs/common/classes";

export default function Account(props) {

    const [interfaces, setInterfaces] = useState([]);
    const [data, setData] = useState({});
    const [shield, setShield] = useState(null);
    const [loading, setLoading] = useState(null);

    function trigger(action, resource, body, setter) {
        const id = Date.now() + resource;
        window.map[id] = (a) => setter(a);
        window.ws.send(JSON.stringify({id, body, action, resource}));
    }

    useEffect(() => {
        if (!props.account) return;
        trigger("get", "interfaces", null, setInterfaces);
        props.account['accountId'] && trigger("get", "account", {login: props.account['accountId']}, setData)
    }, [props.account]);

    if (!props.account || !data) return;

    function close() {
        props.setAccount(null);
        setShield(null);
        setLoading(null);
        setData({});
    }

    function updateAccount(body) {
        const id = Date.now();
        setLoading(true);
        window.map[id] = (res) => {
            setLoading(false);
            if (props.account['accountId']) {
                close();
            } else if (res) {
                if (res?.shield) {
                    setShield(true);
                } else {
                    close();
                }
            }
        };
        window.ws.send(JSON.stringify({
            id,
            body,
            action: props.account['accountId'] ? "post" : "put",
            resource: "account"
        }));
    }

    function getTitle() {
        return props.account['login'] || "New Account";
    }

    return (
        <>
            <Dialog
                style={{width: "40%"}}
                icon="info-sign"
                title={getTitle()}
                isOpen={props.account}
                onClose={() => close()}
            >
                <div className={Classes.DIALOG_BODY}>

                    {!props?.account?.['accountId'] && <>
                        <Callout intent={"danger"}>L'ajout de compte est temporairement désactivé car Ankama a mit une
                            sécurité (Aucun délai à donner pour fix)</Callout>
                        <br/>
                    </>}
                    <HTMLTable condensed bordered style={{marginTop: "5px", marginBottom: "5px", width: '100%'}}>
                        <thead>
                        <tr>
                            <th width="30%">Paramètre</th>
                            <th width="70%">Valeur</th>
                        </tr>
                        </thead>
                        <tbody>
                        {(!props.account?.['accountId'] ? [['Login', 'login'], ['Password', 'password'], ['Alias', 'alias']] : [['Alias', 'alias']])
                            .map(([label, prop], i) =>
                                <tr key={i}>
                                    <td>{label}</td>
                                    <td>
                                        <InputGroup
                                            type={prop === "password" ? prop : 'text'}
                                            onChange={(e) => setData({...data, [prop]: e.target.value})}
                                            value={data?.[prop] ?? ""}
                                        />
                                    </td>
                                </tr>
                            )}
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
                        <Button
                            disabled={!props?.account?.['accountId']}
                            loading={loading}
                            intent="primary"
                            text="Sauvegarder les changements"
                            onClick={() => updateAccount(data)}
                        />
                    </div>
                </div>
            </Dialog>
            <Alert
                icon="lock"
                canOutsideClickCancel={true}
                canEscapeKeyCancel={true}
                isOpen={shield}
                loading={loading}
                onClose={() => close()}
            >
                <FormGroup style={{width: "300px"}}>
                    <InputGroup
                        placeholder={"Code Shield"}
                        onChange={(e) => {
                            data.code = e.target.value.split(' ').join('');
                            setData({...data});
                            if (data.code.length === 6) {
                                const id = Date.now();
                                setLoading(true);
                                window.map[id] = (res) => {
                                    setLoading(false);
                                    if (res) close();
                                };
                                window.ws.send(JSON.stringify({
                                    id,
                                    body: data,
                                    action: "post",
                                    resource: "shield"
                                }));
                            }
                        }}
                        value={data?.code}
                    />
                </FormGroup>
            </Alert>
        </>
    )
}