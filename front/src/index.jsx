import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css';
import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import {FocusStyleManager} from "@blueprintjs/core";
import Dofus from "./Dofus";

FocusStyleManager.onlyShowFocusOnTabs();

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <Dofus/>
    </React.StrictMode>,
);

