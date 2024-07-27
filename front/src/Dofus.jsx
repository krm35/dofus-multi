import React, {useEffect, useState} from 'react';
import {AnchorButton, Button, Callout, HTMLTable, Icon, InputGroup, Popover, Switch} from "@blueprintjs/core";
import ColumnFilter from "./ColumnFilter";
import {Position} from "@blueprintjs/core/lib/esnext/common/position";
import {PopoverInteractionKind} from "@blueprintjs/core/lib/esm/components/popover/popover";
import Account from "./Account";
import {initWS} from "./utilities";

export default function Dofus() {

    const [accounts, setAccounts] = useState({});
    const [account, setAccount] = useState(null);
    const [version, setVersion] = useState(null);
    const [theme, setTheme] = useState(localStorage['theme'] || 'dark');
    const [launcher, setLauncher] = useState(localStorage['launcher']);
    const [like, setLike] = useState(localStorage['like']);
    const [liked, setLiked] = useState({});
    const [search, setSearch] = useState(
        localStorage['mySearch'] ? JSON.parse(localStorage['mySearch']) :
            ["", {
                column: {
                    "Like": true,
                    "Nom de compte": true,
                    "Alias": true,
                    "IP": true,
                    "API Key": false,
                    "Account ID": false,
                }
            }]
    );
    for (let i in accounts) {
        const account = accounts[i];
        if (localStorage[account['login'] + 'like']) {
            liked[account['login'] + 'like'] = true;
        }
    }

    document.body.className = theme === 'dark' ? "bp3-dark dark" : "bp3-body";

    window.accounts = accounts;
    window.setAccounts = setAccounts;
    window.map["version"] = (a) => setVersion(a);
    useEffect(() => initWS(), []);


    useEffect(() => {
        localStorage['mySearch'] = JSON.stringify(search);
    }, [search]);

    function dofusLogin(login, type, delay) {
        const id = Date.now() + login;
        const button = document.getElementById("button_login_" + login + type);
        if (!button || button.style.opacity === "0.5") return;
        button.style.opacity = "0.5";
        window.ws.send(JSON.stringify({
            id,
            body: {account: login, delay, type},
            action: "get",
            resource: "connect"
        }));
    }

    function logAll(type) {
        const delay = 3;
        let i = 0;
        filter(accounts).map(login => {
            const account = shouldPrint(login);
            if (account) {
                if (type === 1 && account['retroPort']) return;
                if (type === 2 && account['d2Port']) return;
                if (type === 3 && account['wakfuPort']) return;
                dofusLogin(login, type, delay * i);
                i++;
            }
        });
    }

    function shouldPrint(login) {
        if (login.startsWith("uuid") && login.length === 40) return;
        const account = accounts[login];
        if (!account || account.deleted) return;
        if (like && !localStorage[account['login'] + 'like']) return;
        if (!launcher && !account.added) return;
        return account;
    }

    if (!accounts) return;

    function hasOneColumnFilter() {
        for (let key in search[1]) {
            if (key === "column" || key === "sort") continue;
            if (Object.keys(search[1][key]).length) {
                return true;
            }
        }
    }

    function filterByColumns(obj) {
        const res = {};
        if (!hasOneColumnFilter()) return obj;
        for (let i in obj) {
            if (typeof obj[i] === "object") {
                for (let key in search[1]) {
                    if (search[1][key][obj[i][key]]) {
                        res[i] = obj[i];
                        break;
                    }
                }
            }
        }
        return res;
    }

    function filterBySearch(obj) {
        let res = {};
        if (typeof obj === "string" || typeof obj === "number") {
            if (String(obj).toLowerCase().includes(search[0])) {
                res = obj;
            }
        } else {
            for (let i in obj) {
                if (i.toLowerCase().includes(search[0])) {
                    res[i] = obj[i];
                }
                if ((typeof obj[i] === "string" || typeof obj[i] === "number") && String(obj[i]).toLowerCase().includes(search[0])) {
                    res[i] = obj[i];
                }
                if (typeof obj[i] === "object") {
                    for (let y in obj[i]) {
                        if (Object.keys(filterBySearch(obj[i][y])).length) {
                            res[i] = obj[i];
                        }
                    }
                }
            }
        }
        return res;
    }

    function filter(obj) {
        const accountsFiltered = filterBySearch(filterByColumns(obj));
        const accountsToSort = [];
        for (let accountId in accountsFiltered) accountsToSort.push(accounts[accountId]);
        const {sort} = search[1];
        return (sort ? accountsToSort.sort((a, b) => (a[sort]?.toString() ?? "").localeCompare(b[sort]?.toString() ?? "")) : accountsToSort).map(({accountId}) => "" + accountId);
    }

    const sort = (prop) => <Icon
        icon={search[1].sort === prop ? "caret-down" : "double-caret-vertical"}
        onClick={() => {
            if (search[1].sort === prop) delete search[1].sort;
            else search[1].sort = prop;
            setSearch([...search]);
        }}/>;

    const columns = {
        "Like": (key) => <th key={key} width="1%" onClick={() => {
            if (localStorage['like']) delete localStorage['like'];
            else localStorage['like'] = true;
            setLike(!like);
        }} className="pointer" style={{position: "relative", fontSize: "10px"}}>
            <Icon style={{position: "absolute", bottom: "40%"}} icon={like ? "star" : "star-empty"}/></th>
        ,
        "Nom de compte": (key) => <th style={{position: "relative"}} key={key} width="10%">
            <label style={{position: "absolute", bottom: "40%"}}>{sort('login')} Nom de compte</label>
        </th>
        ,
        "Alias": (key) => <th style={{position: "relative"}} key={key} width="10%">
            <div style={{position: "absolute", bottom: "40%"}}>
                <Popover
                    content={
                        <ColumnFilter
                            search={search}
                            setSearch={setSearch}
                            items={accounts}
                            column={"alias"}
                        />
                    }
                    enforceFocus={true}
                    position={Position.BOTTOM}
                    interactionKind={PopoverInteractionKind.HOVER}
                >
                    <Icon intent={Object.keys(search?.[1]?.['alias'] ?? {}).length ? 'primary' : ''} size={17}
                          icon="filter-list"/>
                </Popover>
            </div>

            <label style={{position: "absolute", bottom: "40%", left: "35px"}}>{sort('alias')} Alias</label>
        </th>
        ,
        "IP": (key) => <th style={{position: "relative"}} key={key} width="10%">
            <label style={{position: "absolute", bottom: "40%"}}>IP</label>
        </th>
        ,
        "API Key": (key) => <th style={{position: "relative"}} key={key} width="10%">
            <label style={{position: "absolute", bottom: "40%"}}>{sort('key')} API Key</label>
        </th>
        ,
        "Account ID": (key) => <th style={{position: "relative"}} key={key} width="10%">
            <label style={{position: "absolute", bottom: "40%"}}>{sort('accountId')} Account ID</label>
        </th>
    };

    function classicRow(key, account, onClick, text) {
        return <td key={key} onClick={onClick}>{text}</td>
    }

    const rows = {
        "Like": (key, account) => {
            return <td key={key} onClick={() => {
                if (!localStorage[account['login'] + 'like']) {
                    localStorage[account['login'] + 'like'] = true;
                    liked[account['login'] + 'like'] = true;
                } else {
                    delete localStorage[account['login'] + 'like'];
                    delete liked[account['login'] + 'like'];
                }
                setLiked({...liked});
            }} style={{fontSize: "9px", textAlign: "left"}}>
                <Icon icon={liked[account['login'] + 'like'] ? "star" : "star-empty"}/>
            </td>;
        },
        "Nom de compte": (key, account, onClick) => classicRow(key, account, onClick, account['login']),
        "Alias": (key, account, onClick) => classicRow(key, account, onClick, account['alias']),
        "IP": (key, account, onClick) => classicRow(key, account, onClick, account['proxy'] ? account['proxy']['hostname'] : (account['localAddress'] || "ip par défaut")),
        "API Key": (key, account, onClick) => classicRow(key, account, onClick, account['key']),
        "Account ID": (key, account, onClick) => classicRow(key, account, onClick, account['accountId']),
    };

    return (
        <div style={{paddingTop: "10px"}}>
            {version &&
            <>
                <Callout
                    intent={"primary"}>
                    Une nouvelle version sera bientôt disponible sur <a
                    target={"_blank"}
                    href={"https://github.com/krm35/dofus-multi/releases"}>https://github.com/krm35/dofus-multi/releases</a>
                </Callout>
                <br/>
            </>}
            <div style={{display: "flex", justifyContent: "center"}}>
                <Button
                    intent={"primary"}
                    text={theme === "dark" ? "Light" : "Dark"}
                    icon={theme === "dark" ? "flash" : "moon"}
                    onClick={() => {
                        const newTheme = theme === "dark" ? "light" : "dark";
                        document.body.className = newTheme === 'dark' ? "bp3-dark" : "bp3-body";
                        setTheme(newTheme);
                        localStorage.theme = newTheme;
                    }}
                />
                &nbsp;
                <Button intent={"success"} text={"Ajouter un compte"} icon={"add"} onClick={() => setAccount({})}/>
                <InputGroup
                    style={{width: "800px"}}
                    placeholder={"Recherche"}
                    onChange={(e) => {
                        search[0] = e.target.value;
                        setSearch([...search]);
                    }}
                    value={search[0]}
                />
                <Button intent={"danger"} text={"Vider le cache"} icon={"trash"} onClick={() => {
                    for (let i in localStorage) delete localStorage[i];
                    window.location = window.location.href;
                }}/>
                &nbsp;
                <AnchorButton
                    intent={"warning"}
                    text={"Bug Report"}
                    icon={"help"}
                    href={"https://github.com/krm35/dofus-multi/discussions"}
                    target={"_blank"}
                />
            </div>
            <br/>
            <Switch
                labelElement={<strong>Afficher les comptes présents sur le vrai launcher Ankama Games</strong>}
                checked={launcher}
                onChange={() => {
                    if (launcher) delete localStorage['launcher'];
                    else localStorage['launcher'] = true;
                    setLauncher(!launcher);
                }}
            />
            <HTMLTable striped bordered interactive style={{marginTop: "5px", marginBottom: "5px", width: '100%'}}>
                <thead>
                <tr>
                    {Object.keys(columns).map((column, i) => {
                        if (search[1].column[column]) return columns[column](i);
                    })}
                    <th width="10%">
                        <div style={{display: "flex"}}>
                            <img onClick={() => logAll(1)} src={"/img/retroicon.png"} style={{height: "40px"}}
                                 alt={""}/>
                            &nbsp;
                            <img onClick={() => logAll(2)} src={"/img/dofusicon.png"} style={{height: "40px"}}
                                 alt={""}/>
                            &nbsp;
                            <img onClick={() => logAll(3)} src={"/img/wakfuicon.png"} style={{height: "40px"}}
                                 alt={""}/>
                            &nbsp;
                        </div>
                    </th>
                    <th width="0.01%">
                        <Popover
                            content={
                                <ColumnFilter
                                    search={search}
                                    setSearch={setSearch}
                                    items={accounts}
                                    column={"column"}
                                    possibilities={Object.keys(columns)}
                                />
                            }
                            enforceFocus={true}
                            position={Position.BOTTOM}
                            interactionKind={PopoverInteractionKind.HOVER}
                        >
                            <div style={{transform: "rotate(90deg)"}}>
                                <Icon size={15} icon="more"/>
                            </div>
                        </Popover>
                    </th>
                </tr>
                </thead>
                <tbody>
                {filter(accounts).map((login, i) => {
                    const account = shouldPrint(login);
                    if (!account) return;
                    const onClick = () => setAccount(account);
                    return (
                        <tr key={i}>
                            {Object.keys(rows).map((column, i) => {
                                if (search[1].column[column]) return rows[column](i, account, onClick);
                            })}
                            <td>
                                &nbsp;
                                <img
                                    id={"button_login_" + login + "1"}
                                    src={"/img/retroicon.png"}
                                    style={{height: "30px", opacity: account['retroPort'] ? "0.5" : "1"}}
                                    alt={""}
                                    onClick={() => dofusLogin(login, 1)}
                                />
                                &nbsp;&nbsp;&nbsp;&nbsp;
                                <img
                                    id={"button_login_" + login + "2"}
                                    src={"/img/dofusicon.png"}
                                    style={{height: "30px", opacity: account['d2Port'] ? "0.5" : "1"}}
                                    alt={""}
                                    onClick={() => dofusLogin(login, 2)}
                                />
                                &nbsp;&nbsp;&nbsp;&nbsp;
                                <img
                                    id={"button_login_" + login + "3"}
                                    src={"/img/wakfuicon.png"}
                                    style={{height: "30px", opacity: account['wakfuPort'] ? "0.5" : "1"}}
                                    alt={""}
                                    onClick={() => dofusLogin(login, 3)}
                                />
                            </td>
                            <td><Button outlined={true} icon={"cross"} onClick={() => {
                                window.ws.send(JSON.stringify({
                                    body: {account: login},
                                    action: "delete",
                                    resource: "account"
                                }))
                            }}/></td>
                        </tr>)
                })}
                </tbody>
            </HTMLTable>
            <Account setAccount={setAccount} account={account}/>
        </div>
    );
}