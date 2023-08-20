import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import "normalize.css";
import "@blueprintjs/core/lib/css/blueprint.css";
import "@blueprintjs/icons/lib/css/blueprint-icons.css";
import App from './App';

import {FocusStyleManager} from "@blueprintjs/core";

FocusStyleManager.onlyShowFocusOnTabs();

ReactDOM.render(<App/>, document.getElementById('root'));
