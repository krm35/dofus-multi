import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import {FocusStyleManager} from "@blueprintjs/core";
import Dofus from "./Dofus";

FocusStyleManager.onlyShowFocusOnTabs();

ReactDOM.render(<Dofus/>, document.getElementById('root'));
