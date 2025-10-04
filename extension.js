import St from 'gi://St';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

const EthGasPriceIndicator = GObject.registerClass(
    class EthGasPriceIndicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, "Ethereum Gas Price Indicator");

            this.buttonText = new St.Label({
                text: 'Loading...',
                y_align: Clutter.ActorAlign.CENTER,
                x_expand: true,
                natural_width: 180
            });
            this.add_child(this.buttonText);

            this._refresh();
            this._refreshTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 30, () => {
                this._refresh();
                return GLib.SOURCE_CONTINUE;
            });
        }

        _refresh() {
            this._loadGasPrice((safePrice, fastPrice) => {
                const text = `⛽ Safe ${safePrice} / Fast ${fastPrice}`;
                this.buttonText.set_text(text);
                // Add tooltip to show full gas prices
                this.buttonText.set_tooltip_text(`Ethereum Gas Prices\nSafe: ${safePrice} Gwei\nFast: ${fastPrice} Gwei`);
            });
        }

        _loadGasPrice(callback) {
            let url = 'https://api.etherscan.io/api?module=gastracker&action=gasoracle';
            let session = new Soup.Session();
            let message = Soup.Message.new('GET', url);

            session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null, (session, result) => {
                if (message.get_status() === Soup.Status.OK) {
                    let bytes = session.send_and_read_finish(result);
                    let decoder = new TextDecoder('utf-8');
                    let responseText = decoder.decode(bytes.get_data());
                    try {
                        let response = JSON.parse(responseText);
                        if (response.status === "1" && response.result && response.result.SafeGasPrice && response.result.FastGasPrice) {
                            let safePrice = parseFloat(response.result.SafeGasPrice).toFixed(2);
                            let fastPrice = parseFloat(response.result.FastGasPrice).toFixed(2);
                            callback(safePrice, fastPrice);
                        } else {
                            console.warn(`Unexpected API response: ${responseText}`);
                            callback('API Error', 'API Error');
                        }
                    } catch (e) {
                        console.error(`Error parsing API response: ${e.message}`);
                        console.error(`Response text: ${responseText}`);
                        callback('Parse Error', 'Parse Error');
                    }
                } else {
                    console.error(`HTTP Error: ${message.get_status()}`);
                    callback('HTTP Error', 'HTTP Error');
                }
            });
        }

        destroy() {
            if (this._refreshTimeout) {
                GLib.source_remove(this._refreshTimeout);
            }
            super.destroy();
        }
    }
);

export default class Extension {
    constructor() {
        this._indicator = null;
    }

    enable() {
        this._indicator = new EthGasPriceIndicator();
        Main.panel.addToStatusArea('eth-gas-price', this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
