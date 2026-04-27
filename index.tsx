/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}


const initialOptions = {
    clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
    intent: 'subscription',
    vault: true,
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <PayPalScriptProvider options={initialOptions}>
      <App />
    </PayPalScriptProvider>
  </React.StrictMode>
);
