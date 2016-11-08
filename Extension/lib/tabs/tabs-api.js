/* global adguard, require, console */
/**
 * This file is part of Adguard Browser Extension (https://github.com/AdguardTeam/AdguardBrowserExtension).
 *
 * Adguard Browser Extension is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard Browser Extension is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with Adguard Browser Extension.  If not, see <http://www.gnu.org/licenses/>.
 */

var UrlUtils = require('../../lib/utils/url').UrlUtils;
var EventChannels = require('../../lib/utils/common').EventChannels;

(function () {

    'use strict';

    try {

    if (typeof adguard === 'undefined') {
        return;
    }

    adguard.windowsImpl = adguard.windowsImpl || (function () {

            function noOpFunc() {
                throw new Error('Not implemented');
            }

            var emptyListener = {
                addListener: noOpFunc,
                removeListener: noOpFunc
            };

            return {

                onCreated: emptyListener,
                onRemoved: emptyListener,
                onUpdated: emptyListener,

                create: noOpFunc,
                getAll: noOpFunc,
                getLastFocused: noOpFunc
            };
        });

    adguard.windows = (function (windowsImpl) {

        var AdguardWin = {
            windowId: 1,
            type: 'normal' // 'popup'
        };

        function noOpFunc() {
        }

        var windowsMetadata = Object.create(null); // windowId => [AdguardWin, NativeWin]

        windowsImpl.getAll(function (aWindowsMetadata) {
            for (var i = 0; i < aWindowsMetadata.length; i++) {
                var metadata = aWindowsMetadata[i];
                windowsMetadata[metadata[0].windowId] = metadata;
            }
        });

        var onCreatedChannel = EventChannels.newChannel();
        var onRemovedChannel = EventChannels.newChannel();
        var onUpdatedChannel = EventChannels.newChannel();

        windowsImpl.onCreated.addListener(function (win, nativeWin) {
            windowsMetadata[win.windowId] = [win, nativeWin];
            onCreatedChannel.notify(win, nativeWin);
        });

        windowsImpl.onUpdated.addListener(function (win, nativeWin, eventType) {
            var metadata = windowsMetadata[win.windowId];
            if (metadata) {
                metadata[0].type = win.type;
                metadata[1] = nativeWin;
                onUpdatedChannel.notify(metadata[0], metadata[1], eventType);
            }
        });

        windowsImpl.onRemoved.addListener(function (windowId) {
            var metadata = windowsMetadata[windowId];
            if (metadata) {
                onRemovedChannel.notify(metadata[0], metadata[1]);
                delete windowsMetadata[windowId];
            }
        });

        var create = function (createData, callback) {
            windowsImpl.create(createData, callback || noOpFunc);
        };

        var getAll = function (callback) {

            windowsImpl.getAll(function (aWindowsMetadata) {

                var wins = [];
                var nativeWins = [];

                for (var i = 0; i < aWindowsMetadata.length; i++) {
                    var aMetadata = aWindowsMetadata[i];
                    var windowId = aMetadata[0].windowId;
                    var metadata = windowsMetadata[windowId];
                    if (!metadata) {
                        windowsMetadata[windowId] = metadata = aMetadata;
                    }
                    wins.push(metadata[0]);
                    nativeWins.push(metadata[1]);
                }

                callback(wins, nativeWins);
            });
        };

        var getLastFocused = function (callback) {

            windowsImpl.getLastFocused(function (windowId) {
                var metadata = windowsMetadata[windowId];
                if (metadata) {
                    callback(metadata[0], metadata[1]);
                }
            });
        };

        return {

            onCreated: onCreatedChannel,
            onRemoved: onRemovedChannel,
            onUpdated: onUpdatedChannel,

            create: create,
            getAll: getAll,
            getLastFocused: getLastFocused
        };

    })(adguard.windowsImpl);

    adguard.tabsImpl = adguard.tabsImpl || (function () {

            function noOpFunc() {
                throw new Error('Not implemented');
            }

            var emptyListener = {
                addListener: noOpFunc,
                removeListener: noOpFunc
            };

            return {

                onCreated: emptyListener,	// callback(tab)
                onRemoved: emptyListener,	// callback(tabId)
                onUpdated: emptyListener,	// callback(tab)
                onActivated: emptyListener, 	// callback(tabId)

                create: noOpFunc,		// callback(tab)
                remove: noOpFunc,		// callback(tabId)
                activate: noOpFunc,		// callback(tabId)
                reload: noOpFunc,
                sendMessage: noOpFunc,
                getAll: noOpFunc,		// callback(tabs)
                getActive: noOpFunc		// callback(tabId)
            };

        })();

    adguard.tabs = (function (tabsImpl) {

        var AdguardTab = {
            tabId: 1,
            url: 'url',
            title: 'Title',
            incognito: false,
            status: null,   // 'loading' or 'complete'
            frames: null,   // Collection of frames inside tab
            metadata: null  // Contains info about integration, white list rule is applied to tab.
        };

        var AdguardTabFrame = {
            frameId: 1,
            url: 'url',
            domainName: 'domainName'
        };

        function noOpFunc() {
        }

        var tabs = Object.create(null);

        // Synchronize opened tabs
        tabsImpl.getAll(function (aTabs) {
            for (var i = 0; i < aTabs.length; i++) {
                var aTab = aTabs[i];
                tabs[aTab.tabId] = aTab;
            }
        });

        tabsImpl.onCreated.addListener(function (aTab) {
            tabs[aTab.tabId] = aTab;
            onCreatedChannel.notify(aTab);
        });

        tabsImpl.onRemoved.addListener(function (tabId) {
            var tab = tabs[tabId];
            if (tab) {
                onRemovedChannel.notify(tab);
                delete tabs[tabId];
            }
        });

        tabsImpl.onUpdated.addListener(function (aTab) {
            var tab = tabs[aTab.tabId];
            if (tab) {
                tab.url = aTab.url;
                tab.title = aTab.title;
                tab.status = aTab.status;
                onUpdatedChannel.notify(tab);
            }
        });

        tabsImpl.onActivated.addListener(function (tabId) {
            var tab = tabs[tabId];
            if (tab) {
                onActivatedChannel.notify(tab);
            }
        });

        // Fired when a tab is created. Note that the tab's URL may not be set at the time this event fired, but you can listen to onUpdated events to be notified when a URL is set.

        var onCreatedChannel = EventChannels.newChannel();

        // Fired when a tab is closed.
        var onRemovedChannel = EventChannels.newChannel();

        // Fired when a tab is updated.
        var onUpdatedChannel = EventChannels.newChannel();

        // Fires when the active tab in a window changes.
        var onActivatedChannel = EventChannels.newChannel();

        // --------- Actions ---------

        // Creates a new tab.
        var create = function (details, callback) {
            tabsImpl.create(details, callback || noOpFunc);
        };

        // Closes tab.
        var remove = function (tabId, callback) {
            tabsImpl.remove(tabId, callback || noOpFunc);
        };

        // Activates tab (Also makes tab's window in focus).
        var activate = function (tabId, callback) {
            tabsImpl.activate(tabId, callback || noOpFunc);
        };

        // Reloads tab.
        var reload = function (tabId, url) {
            tabsImpl.reload(tabId, url);
        };

        // Sends message to tab
        var sendMessage = function (tabId, message, responseCallback) {
            tabsImpl.sendMessage(tabId, message, responseCallback);
        };

        // Gets all opened tabs
        var getAll = function (callback) {
            tabsImpl.getAll(function (aTabs) {
                var result = [];
                for (var i = 0; i < aTabs.length; i++) {
                    var aTab = aTabs[i];
                    var tab = tabs[aTab.tabId];
                    if (!tab) {
                        // Synchronize state
                        tabs[aTab.tabId] = tab = aTab;
                    }
                    result.push(tab);
                }
                callback(result);
            });
        };

        // Gets active tab
        var getActive = function (callback) {
            tabsImpl.getActive(function (tabId) {
                var tab = tabs[tabId];
                if (tab) {
                    callback(tab);
                }
            });
        };

        var isIncognito = function (tabId) {
            var tab = tabs[tabId];
            return tab && tab.incognito === true;
        };

        // Records tab's frame
        var recordTabFrame = function (tabId, frameId, url) {
            var tab = tabs[tabId];
            if (tab) {
                if (!tab.frames) {
                    tab.frames = Object.create(null);
                }
                tab.frames[frameId] = {
                    url: url,
                    domainName: UrlUtils.getDomainName(url)
                };
            }
        };

        var clearTabFrames = function (tabId) {
            var tab = tabs[tabId];
            if (tab) {
                tab.frames = null;
            }
        };

        // Gets tab's frame by id
        var getTabFrame = function (tabId, frameId) {
            var tab = tabs[tabId];
            if (tab && tab.frames) {
                return tab.frames[frameId || 0];
            }
            return null;
        };

        // Update tab metadata
        var updateTabMetadata = function (tabId, values) {
            var tab = tabs[tabId];
            if (tab) {
                if (!tab.metadata) {
                    tab.metadata = Object.create(null);
                }
                for (var key in values) {
                    if (values.hasOwnProperty && values.hasOwnProperty(key)) {
                        tab.metadata[key] = values[key];
                    }
                }
            }
        };

        // Gets tab metadata
        var getTabMetadata = function (tabId, key) {
            var tab = tabs[tabId];
            if (tab && tab.metadata) {
                return tab.metadata[key];
            }
            return null;
        };

        var clearTabMetadata = function (tabId) {
            var tab = tabs[tabId];
            if (tab) {
                tab.metadata = null;
            }
        };

        return {

            // Events
            onCreated: onCreatedChannel,
            onRemoved: onRemovedChannel,
            onUpdated: onUpdatedChannel,
            onActivated: onActivatedChannel,

            // Actions
            create: create,
            remove: remove,
            activate: activate,
            reload: reload,
            sendMessage: sendMessage,
            getAll: getAll,
            getActive: getActive,
            isIncognito: isIncognito,

            // Frames
            recordTabFrame: recordTabFrame,
            clearTabFrames: clearTabFrames,
            getTabFrame: getTabFrame,

            // Other
            updateTabMetadata: updateTabMetadata,
            getTabMetadata: getTabMetadata,
            clearTabMetadata: clearTabMetadata
        };

    })(adguard.tabsImpl);

    }catch(ex){
        console.error(ex);
    }

})();