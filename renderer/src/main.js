import { jsx as _jsx } from "react/jsx-runtime";
import { createRoot } from 'react-dom/client';
import { App } from './App';
const container = document.getElementById('root');
if (!container) {
    throw new Error('Root container #root not found');
}
const root = createRoot(container);
root.render(_jsx(App, {}));
