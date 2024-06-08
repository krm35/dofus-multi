import {Checkbox, Menu} from "@blueprintjs/core";
import React from "react";

export default function ColumnFilter(props) {

    const {search, setSearch, items, column, possibilities} = props;

    function getPossibilities(items, key) {
        const res = {};
        for (let i in items) {
            for (let prop in items[i]) {
                if (prop === key) {
                    if (!res[items[i][prop]]) {
                        res[items[i][prop]] = true;
                    }
                }
            }
        }
        for (let i in search[1][key]) res[i] = true;
        return Object.keys(res);
    }

    return (
        <Menu>
            {(possibilities || getPossibilities(items, column)).map((type, i) => {
                if (!search[1][column]) search[1][column] = {};
                const isChecked = search[1][column][type];
                return <Checkbox
                    key={i}
                    label={type}
                    onClick={() => {
                        if (!isChecked) search[1][column][type] = true;
                        else delete search[1][column][type];
                        setSearch([...search]);
                    }}
                    checked={isChecked}
                />
            })}
        </Menu>
    )
}