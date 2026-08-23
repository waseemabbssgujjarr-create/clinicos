/**
 * Shared app utilities — toast, modal, bottom sheet, nav helpers.
 */

const App = {
    /**
     * Show a toast notification.
     * @param {string} message
     * @param {'success'|'error'|'info'} type
     * @param {number} duration ms
     */
    toast(message, type = 'info', duration = 3500) {
        let container = document.querySelector('.toast-container');
        if (!container) {
            container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const el = document.createElement('div');
        el.className = `toast toast-${type}`;
        el.textContent = message;
        container.appendChild(el);

        setTimeout(() => {
            el.style.opacity = '0';
            el.style.transition = 'opacity 0.3s';
            setTimeout(() => el.remove(), 300);
        }, duration);
    },

    /**
     * Open a bottom sheet by ID.
     * @param {string} sheetId
     */
    openBottomSheet(sheetId) {
        const overlay = document.getElementById(`${sheetId}-overlay`);
        const sheet = document.getElementById(sheetId);
        if (overlay) overlay.classList.add('open');
        if (sheet) sheet.classList.add('open');
        document.body.style.overflow = 'hidden';
    },

    /**
     * Close a bottom sheet by ID.
     * @param {string} sheetId
     */
    closeBottomSheet(sheetId) {
        const overlay = document.getElementById(`${sheetId}-overlay`);
        const sheet = document.getElementById(sheetId);
        if (overlay) overlay.classList.remove('open');
        if (sheet) sheet.classList.remove('open');
        document.body.style.overflow = '';
    },

    openMobileMenu() {
        const overlay = document.getElementById('client-mobile-menu-overlay');
        const drawer = document.getElementById('client-mobile-menu');
        const trigger = document.querySelector('.client-mobile-menu-btn[aria-controls="client-mobile-menu"]');
        if (overlay) {
            overlay.classList.add('open');
            overlay.setAttribute('aria-hidden', 'false');
        }
        if (drawer) {
            drawer.classList.add('open');
            drawer.setAttribute('aria-hidden', 'false');
        }
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'true');
        }
        document.body.style.overflow = 'hidden';
    },

    closeMobileMenu() {
        const overlay = document.getElementById('client-mobile-menu-overlay');
        const drawer = document.getElementById('client-mobile-menu');
        const trigger = document.querySelector('.client-mobile-menu-btn[aria-controls="client-mobile-menu"]');
        if (overlay) {
            overlay.classList.remove('open');
            overlay.setAttribute('aria-hidden', 'true');
        }
        if (drawer) {
            drawer.classList.remove('open');
            drawer.setAttribute('aria-hidden', 'true');
        }
        if (trigger) {
            trigger.setAttribute('aria-expanded', 'false');
        }
        const modalOpen = document.getElementById('app-confirm-modal')
            || document.querySelector('.bottom-sheet.open');
        if (!modalOpen) {
            document.body.style.overflow = '';
        }
    },

    openAdminSidebar() {
        const sidebar = document.getElementById('admin-sidebar');
        const overlay = document.getElementById('admin-sidebar-overlay');
        const toggle = document.getElementById('admin-sidebar-toggle');
        document.body.classList.add('admin-sidebar-open');
        if (sidebar) {
            sidebar.classList.add('is-open');
        }
        if (overlay) {
            overlay.classList.add('is-open');
            overlay.setAttribute('aria-hidden', 'false');
        }
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'true');
            toggle.setAttribute('aria-label', 'Close admin menu');
        }
        document.body.style.overflow = 'hidden';
    },

    closeAdminSidebar() {
        const sidebar = document.getElementById('admin-sidebar');
        const overlay = document.getElementById('admin-sidebar-overlay');
        const toggle = document.getElementById('admin-sidebar-toggle');
        document.body.classList.remove('admin-sidebar-open');
        if (sidebar) {
            sidebar.classList.remove('is-open');
        }
        if (overlay) {
            overlay.classList.remove('is-open');
            overlay.setAttribute('aria-hidden', 'true');
        }
        if (toggle) {
            toggle.setAttribute('aria-expanded', 'false');
            toggle.setAttribute('aria-label', 'Open admin menu');
        }
        const modalOpen = document.getElementById('app-confirm-modal')
            || document.querySelector('.bottom-sheet.open');
        if (!modalOpen) {
            document.body.style.overflow = '';
        }
    },

    toggleAdminSidebar() {
        const sidebar = document.getElementById('admin-sidebar');
        if (sidebar?.classList.contains('is-open')) {
            this.closeAdminSidebar();
        } else {
            this.openAdminSidebar();
        }
    },

    /**
     * Confirm dialog using custom modal (no alert/confirm).
     * @param {string} message
     * @param {Function} onConfirm
     */
    confirm(message, onConfirm) {
        const existing = document.getElementById('app-confirm-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'app-confirm-modal';
        modal.className = 'fixed inset-0 z-[200] flex items-end md:items-center justify-center p-edge-margin';
        modal.innerHTML = `
            <div class="absolute inset-0 bg-black/40" data-dismiss></div>
            <div class="relative bg-surface-container-lowest rounded-2xl p-lg w-full max-w-sm shadow-xl safe-bottom">
                <p class="text-body-lg text-on-surface mb-lg">${message}</p>
                <div class="flex gap-sm">
                    <button type="button" data-dismiss class="flex-1 h-12 rounded-xl border border-outline-variant text-body-md active:scale-95 transition-transform">Cancel</button>
                    <button type="button" data-confirm class="flex-1 h-12 rounded-xl bg-primary text-on-primary font-title text-title-md active:scale-95 transition-transform">Confirm</button>
                </div>
            </div>`;

        document.body.appendChild(modal);
        document.body.style.overflow = 'hidden';

        modal.querySelectorAll('[data-dismiss]').forEach(el => {
            el.addEventListener('click', () => {
                modal.remove();
                document.body.style.overflow = '';
            });
        });

        modal.querySelector('[data-confirm]').addEventListener('click', () => {
            modal.remove();
            document.body.style.overflow = '';
            onConfirm();
        });
    },

    /**
     * Highlight active bottom nav tab.
     * @param {string} activeTab home|connect|monitor|settings|leads|clients|bots
     */
    setActiveNav(activeTab) {
        document.querySelectorAll('[data-nav]').forEach(el => {
            const isActive = el.dataset.nav === activeTab;
            el.classList.toggle('active', isActive);
            if (isActive) {
                el.setAttribute('aria-current', 'page');
            } else {
                el.removeAttribute('aria-current');
            }
        });
    },

    /** @returns {Promise<void>} */
    ensureFbSdkReady(timeoutMs) {
        if (typeof FB !== 'undefined' && window.fbSdkReady) {
            return Promise.resolve();
        }
        if (window.fbSdkFailed) {
            return Promise.reject(new Error('Facebook SDK blocked or failed to load'));
        }
        const waitMs = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 15000;
        return new Promise((resolve, reject) => {
            let poll = null;
            const cleanup = () => {
                clearTimeout(timeout);
                if (poll) {
                    clearInterval(poll);
                }
                document.removeEventListener('fb-sdk-ready', onReady);
                document.removeEventListener('fb-sdk-error', onError);
            };
            const onReady = () => {
                cleanup();
                if (typeof FB !== 'undefined') {
                    resolve();
                } else {
                    reject(new Error('Facebook SDK not available'));
                }
            };
            const onError = () => {
                cleanup();
                reject(new Error('Facebook SDK blocked or failed to load'));
            };
            const timeout = setTimeout(() => {
                cleanup();
                reject(new Error('Facebook SDK load timeout'));
            }, waitMs);
            if (window.fbSdkReady && typeof FB !== 'undefined') {
                cleanup();
                resolve();
                return;
            }
            document.addEventListener('fb-sdk-ready', onReady, { once: true });
            document.addEventListener('fb-sdk-error', onError, { once: true });
            poll = setInterval(() => {
                if (window.fbSdkReady && typeof FB !== 'undefined') {
                    onReady();
                }
            }, 150);
        });
    },

    /** @returns {number} */
    getWaConnectClientId() {
        const btn = document.getElementById('connect-wa-primary')
            || document.querySelector('[data-wa-oauth-connect]');
        return parseInt(btn?.getAttribute('data-wa-client-id') || '0', 10) || 0;
    },

    /**
     * Request OAuth code after Meta FINISH (second FB.login — user usually already authorized).
     * @returns {Promise<string>}
     */
    requestWaOAuthCode(cfg) {
        const signupCfg = cfg || window.metaWaSignup || {};
        if (!signupCfg.configId) {
            return Promise.reject(new Error('WhatsApp signup is not configured.'));
        }
        return App.ensureFbSdkReady(8000).then(() => new Promise((resolve, reject) => {
            FB.login((response) => {
                if (response.authResponse && response.authResponse.code) {
                    resolve(response.authResponse.code);
                    return;
                }
                reject(new Error('Meta did not return an authorization code.'));
            }, {
                config_id: signupCfg.configId,
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    setup: {},
                    featureType: 'whatsapp_business_app_onboarding',
                    sessionInfoVersion: '3',
                    version: 'v4',
                },
            });
        }));
    },

    /** @returns {boolean} */
    isWaEmbeddedSignupFinish(event) {
        const e = String(event || '');
        return e === 'FINISH'
            || e === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
            || e === 'FINISH_ONLY_WABA'
            || e === 'FINISH_OBO_MIGRATION'
            || e === 'FINISH_GRANT_ONLY_API_ACCESS';
    },

    /** @param {Record<string, unknown>|null|undefined} payload */
    parseWaEmbeddedSignupSession(payload) {
        const data = payload && typeof payload === 'object' ? payload : {};
        return {
            waba_id: String(data.waba_id || (Array.isArray(data.waba_ids) ? data.waba_ids[0] : '') || ''),
            phone_number_id: String(data.phone_number_id || ''),
            display_phone_number: String(data.display_phone_number || data.phone_number || ''),
        };
    },

    /**
     * Connect page button + status line during OAuth.
     * @param {'connecting'|'meta'|'saving'|'idle'} phase
     */
    setWaConnectUiPhase(phase) {
        if (window.WaConnect && typeof window.WaConnect.setPhase === 'function') {
            window.WaConnect.setPhase(phase);
            return;
        }
        const btn = document.getElementById('connect-wa-primary')
            || document.querySelector('[data-wa-oauth-connect]');
        const statusEl = document.getElementById('wa-connect-status');
        const spin = '<span class="wa-connect-spin" aria-hidden="true"></span>';

        if (phase === 'idle') {
            if (btn && btn.dataset.waOauthOriginalHtml) {
                btn.disabled = false;
                btn.removeAttribute('aria-busy');
                btn.classList.remove('opacity-70', 'pointer-events-none', 'wa-connect-busy');
                btn.innerHTML = btn.dataset.waOauthOriginalHtml;
            }
            if (statusEl) {
                statusEl.classList.add('hidden');
            }
            return;
        }

        const labels = {
            connecting: ['Connecting…', 'Opening Meta signup…'],
            meta: ['Waiting for Meta…', 'Complete signup in the Meta window — this page stays open.'],
            saving: ['Saving connection…', 'Saving your WhatsApp connection…'],
        };
        const pair = labels[phase] || labels.meta;

        if (btn) {
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.classList.add('opacity-70', 'pointer-events-none', 'wa-connect-busy');
            btn.innerHTML = `${spin}<span>${pair[0]}</span>`;
        }
        if (statusEl) {
            statusEl.classList.remove('hidden');
            statusEl.textContent = pair[1];
        }
    },

    /** Warm Meta SDK in background — never disable the Connect button. */
    initWaConnectPreload() {
        const btn = document.getElementById('connect-wa-primary')
            || document.querySelector('[data-wa-oauth-connect]');
        if (!btn || !window.metaWaSignup) {
            return;
        }

        const markReady = () => {
            btn.dataset.waSdkReady = '1';
            delete btn.dataset.waSdkFailed;
        };
        const markBlocked = () => {
            window.fbSdkFailed = true;
            btn.dataset.waSdkFailed = '1';
            delete btn.dataset.waSdkReady;
        };

        if (window.fbSdkReady && typeof FB !== 'undefined') {
            markReady();
            return;
        }
        if (window.fbSdkFailed) {
            markBlocked();
            return;
        }

        document.addEventListener('fb-sdk-ready', markReady, { once: true });
        document.addEventListener('fb-sdk-error', markBlocked, { once: true });
        App.ensureFbSdkReady(5000).then(markReady).catch(markBlocked);
    },

    /**
     * Popup window features for WhatsApp OAuth.
     * @returns {string}
     */
    waOAuthPopupFeatures() {
        const w = Math.min(720, Math.max(480, screen.width - 48));
        const h = Math.min(820, Math.max(560, screen.height - 48));
        const left = Math.max(0, Math.round((screen.width - w) / 2));
        const top = Math.max(0, Math.round((screen.height - h) / 2));
        return `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`;
    },

    /**
     * Pre-open OAuth popup on user click (avoids blocker after async SDK wait).
     * @returns {Window|null}
     */
    prepareWaOAuthPopup() {
        try {
            return window.open('about:blank', 'iqpigeon-wa-oauth', App.waOAuthPopupFeatures());
        } catch (e) {
            return null;
        }
    },

    /** @returns {Promise<boolean>} */
    fetchWaConnectionStatus() {
        return fetch('/api/whatsapp/connection-status.php', { credentials: 'same-origin', cache: 'no-store' })
            .then((r) => r.json())
            .then((data) => !!(data && data.connected))
            .catch(() => false);
    },

    /** Accept postMessage from callback popup (same host, www or not). */
    isWaOAuthMessageOrigin(origin) {
        if (origin === window.location.origin) {
            return true;
        }
        try {
            return new URL(origin).host === window.location.host;
        } catch (e) {
            return false;
        }
    },

    /**
     * @param {Window} popup
     * @param {{ onSuccess?: () => void, onError?: (msg: string) => void, onClose?: () => void, onMetaFinish?: () => void }} opts
     */
    attachWaOAuthPopupListeners(popup, opts = {}) {
        const messageType = 'iqpigeon-whatsapp-oauth';
        const onSuccess = opts.onSuccess || (() => window.location.reload());
        const onError = opts.onError || ((msg) => { if (msg) App.toast(msg, 'error'); });
        const onClose = opts.onClose || (() => {});
        const onMetaFinish = opts.onMetaFinish || (() => {});
        const metaOrigins = [
            'https://www.facebook.com',
            'https://web.facebook.com',
            'https://business.facebook.com',
        ];

        let done = false;
        let popupClosedHandled = false;
        let pollTimer = null;
        let connectionPoll = null;
        let popupUrlPoll = null;

        const cleanup = () => {
            window.removeEventListener('message', onMessage);
            window.removeEventListener('message', onMetaMessage);
            if (pollTimer) {
                clearInterval(pollTimer);
                pollTimer = null;
            }
            if (connectionPoll) {
                clearInterval(connectionPoll);
                connectionPoll = null;
            }
            if (popupUrlPoll) {
                clearInterval(popupUrlPoll);
                popupUrlPoll = null;
            }
        };

        const finishSuccess = () => {
            if (done) {
                return;
            }
            done = true;
            cleanup();
            try {
                if (!popup.closed) {
                    popup.close();
                }
            } catch (e) { /* ignore */ }
            onSuccess();
        };

        const checkConnection = () => App.fetchWaConnectionStatus().then((connected) => {
            if (connected) {
                finishSuccess();
            }
            return connected;
        });

        const scheduleConnectionChecks = () => {
            checkConnection();
            [1000, 2500, 5000, 8000].forEach((ms) => {
                setTimeout(() => {
                    if (!done) {
                        checkConnection();
                    }
                }, ms);
            });
        };

        const handlePopupClosed = () => {
            if (popupClosedHandled || done) {
                return;
            }
            popupClosedHandled = true;
            scheduleConnectionChecks();
            const clientId = parseInt(String(opts.clientId || '0'), 10);
            const tryRecover = clientId > 0
                ? App.recoverWaSignupIfPending(clientId)
                : Promise.resolve(false);

            tryRecover.then((recovered) => {
                if (recovered || done) {
                    return;
                }
                checkConnection().then((connected) => {
                    if (done || connected) {
                        return;
                    }
                    [2000, 5000, 10000, 20000].forEach((ms) => {
                        setTimeout(() => {
                            if (!done) {
                                checkConnection().then((ok) => {
                                    if (ok || done) {
                                        return;
                                    }
                                    if (ms === 20000) {
                                        cleanup();
                                        onClose();
                                    }
                                });
                            }
                        }, ms);
                    });
                });
            });
        };

        const onMessage = (event) => {
            if (!App.isWaOAuthMessageOrigin(event.origin)) {
                return;
            }
            const data = event.data;
            if (!data || data.type !== messageType || done) {
                return;
            }
            done = true;
            cleanup();
            try {
                if (!popup.closed) {
                    popup.close();
                }
            } catch (e) { /* ignore */ }
            if (data.success) {
                onSuccess();
            } else {
                onError(data.error || 'Connection failed');
            }
        };

        const onMetaMessage = (event) => {
            if (!metaOrigins.includes(event.origin) || done) {
                return;
            }
            let data = event.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    return;
                }
            }
            if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') {
                return;
            }
            if (App.isWaEmbeddedSignupFinish(data.event)) {
                if (window.WaConnect && typeof window.WaConnect.onMetaFinish === 'function') {
                    window.WaConnect.onMetaFinish();
                }
                onMetaFinish();
                fetch('/api/whatsapp/oauth-debug-log.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        step: 'meta_finish_popup',
                        client_id: opts.clientId || 0,
                        event: data.event,
                        data: data.data || {},
                    }),
                }).catch(() => {});
                const sessionData = App.parseWaEmbeddedSignupSession(data.data);
                scheduleConnectionChecks();
                const clientId = parseInt(String(opts.clientId || '0'), 10);
                const sdkOk = !window.fbSdkFailed && typeof FB !== 'undefined' && window.metaWaSignup;
                if (clientId > 0 && sdkOk) {
                    App.finishWaEmbeddedSignup(clientId, sessionData, {
                        startUrl: opts.startUrl || '',
                        onSuccess: finishSuccess,
                        onError: () => {
                            scheduleConnectionChecks();
                        },
                    });
                }
            }
        };

        window.addEventListener('message', onMessage);
        window.addEventListener('message', onMetaMessage);

        connectionPoll = setInterval(() => {
            if (!done) {
                checkConnection();
            }
        }, 2500);

        popupUrlPoll = setInterval(() => {
            if (done || popup.closed) {
                return;
            }
            try {
                const href = popup.location.href;
                if (href.indexOf('/client/whatsapp-oauth-callback') >= 0) {
                    scheduleConnectionChecks();
                }
            } catch (e) { /* cross-origin */ }
        }, 800);

        pollTimer = setInterval(() => {
            if (done) {
                return;
            }
            if (popup.closed) {
                handlePopupClosed();
            }
        }, 400);

        scheduleConnectionChecks();
    },

    /**
     * Open OAuth in a popup — main tab stays on IQ Pigeon.
     * @param {string} startUrl
     * @param {{ onSuccess?: () => void, onError?: (msg: string) => void, onClose?: () => void }} [opts]
     * @returns {boolean} false if popup was blocked
     */
    openWhatsAppOAuthPopup(startUrl, opts = {}) {
        const onError = opts.onError || ((msg) => {
            if (msg) {
                App.toast(msg, 'error');
            }
        });

        if (!startUrl) {
            onError('WhatsApp signup URL is missing.');
            return false;
        }

        let popup = window.open(startUrl, 'iqpigeon-wa-oauth', App.waOAuthPopupFeatures());

        if (!popup) {
            return false;
        }

        const navigatePopup = () => {
            try {
                if (popup.closed) {
                    return;
                }
                const href = popup.location.href || '';
                if (href === 'about:blank' || href === '' || href === 'about:blank#') {
                    popup.location.replace(startUrl);
                }
            } catch (e) { /* cross-origin once Meta loads */ }
        };

        try {
            popup.focus();
        } catch (e) { /* ignore */ }

        navigatePopup();
        setTimeout(navigatePopup, 600);
        setTimeout(navigatePopup, 2000);

        App.attachWaOAuthPopupListeners(popup, opts);
        return true;
    },

    /**
     * Server OAuth — popup on desktop (IQ Pigeon tab unchanged), redirect on mobile.
     * @param {string} startUrl
     * @param {{ isNative?: boolean, isMobile?: boolean, preferRedirect?: boolean, onSuccess?: () => void, onError?: (msg: string) => void, onClose?: () => void, existingPopup?: Window|null }} [opts]
     */
    startWaOAuthRedirect(startUrl, opts = {}) {
        if (!startUrl) {
            if (opts.onError) {
                opts.onError('WhatsApp signup URL is missing.');
            }
            return;
        }

        if (opts.isNative || opts.isMobile || opts.preferRedirect) {
            window.location.href = startUrl;
            return;
        }

        const popupUrl = startUrl + (startUrl.includes('?') ? '&' : '?') + 'popup=1';
        App.openWhatsAppOAuthPopup(popupUrl, opts);
    },

    isWaSdkFailureMessage(msg) {
        return /sdk|timeout|blocked|not loaded|not available/i.test(String(msg || ''));
    },

    /**
     * After Meta FINISH (share complete) — exchange OAuth code and save on our server.
     * @param {number} clientId
     * @param {{ waba_id?: string, phone_number_id?: string, display_phone_number?: string }} sessionData
     * @param {{ onSuccess?: () => void, onError?: (msg: string) => void, startUrl?: string }} [opts]
     * @returns {Promise<void>}
     */
    finishWaEmbeddedSignup(clientId, sessionData, opts = {}) {
        const onSuccess = opts.onSuccess || (() => window.location.reload());
        const onError = opts.onError || ((msg) => { if (msg) App.toast(msg, 'error'); });
        const startUrl = opts.startUrl || '';
        const cfg = window.metaWaSignup || {};

        const exchangeCode = (code) => fetch('/api/whatsapp/exchange-token.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                code,
                client_id: clientId,
                waba_id: sessionData.waba_id || '',
                phone_number_id: sessionData.phone_number_id || '',
                display_phone_number: sessionData.display_phone_number || '',
            }),
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    onSuccess();
                } else {
                    throw new Error(data.error || 'Connection failed');
                }
            });

        const redirectToOAuth = () => {
            if (startUrl && !opts.preferPopup) {
                window.location.href = startUrl;
                return true;
            }
            return false;
        };

        return App.fetchWaConnectionStatus().then((connected) => {
            if (connected) {
                onSuccess();
                return;
            }
            if (!cfg.appId) {
                if (!redirectToOAuth()) {
                    onError('WhatsApp signup is not configured.');
                }
                return;
            }
            return App.ensureFbSdkReady(8000).then(() => new Promise((resolve, reject) => {
                FB.login((response) => {
                    if (response.authResponse && response.authResponse.code) {
                        resolve(response.authResponse.code);
                        return;
                    }
                    reject(new Error('Meta did not return an authorization code.'));
                }, {
                    config_id: cfg.configId,
                    response_type: 'code',
                    override_default_response_type: true,
                    extras: {
                        setup: {},
                        featureType: 'whatsapp_business_app_onboarding',
                        sessionInfoVersion: '3',
                        version: 'v4',
                    },
                });
            }))
                .then(exchangeCode)
                .catch((err) => {
                    if (redirectToOAuth()) {
                        return;
                    }
                    onError(err.message || 'Could not save WhatsApp connection.');
                });
        });
    },

    /**
     * Meta Embedded Signup via FB.login — dialog overlay on this page (recommended).
     * @param {number} clientId
     * @param {{ onSuccess?: () => void, onError?: (msg: string) => void, onSdkReady?: () => void, sdkReady?: boolean }} [opts]
     */
    launchWhatsAppFbSignup(clientId, opts = {}) {
        const cfg = window.metaWaSignup || {};
        const onSuccess = opts.onSuccess || (() => window.location.reload());
        const onError = opts.onError || ((msg) => { if (msg) App.toast(msg, 'error'); });
        const onSdkReady = opts.onSdkReady || (() => {});
        const onMetaFinish = opts.onMetaFinish || (() => {});
        const startUrl = opts.startUrl || '';
        const skipEnsure = opts.sdkReady === true;

        const metaOrigins = [
            'https://www.facebook.com',
            'https://web.facebook.com',
            'https://business.facebook.com',
        ];
        let sessionData = {};
        let finished = false;
        let pendingCode = null;
        let codeReceivedAt = 0;
        let metaFinishReceived = false;
        let connectionPoll = null;
        let cancelTimer = null;
        let focusRetryTimer = null;
        let codeRequestInFlight = false;

        const showSavingStatus = () => {
            App.setWaConnectUiPhase('saving');
        };

        const retryAfterMetaReturn = () => {
            if (finished) {
                return;
            }
            showSavingStatus();
            if (focusRetryTimer) {
                clearTimeout(focusRetryTimer);
            }
            focusRetryTimer = setTimeout(() => {
                if (finished) {
                    return;
                }
                if (pendingCode) {
                    maybeExchange();
                } else if (metaFinishReceived || sessionData.waba_id || sessionData.phone_number_id) {
                    ensureOAuthCodeAndExchange();
                } else {
                    App.recoverWaSignupIfPending(clientId);
                }
                App.fetchWaConnectionStatus().then((connected) => {
                    if (connected) {
                        finished = true;
                        cleanup();
                        clearSignupState();
                        onSuccess();
                    }
                });
            }, 350);
        };

        const onWindowFocus = () => retryAfterMetaReturn();

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                retryAfterMetaReturn();
            }
        };

        const persistSignupState = () => {
            try {
                if (pendingCode) {
                    sessionStorage.setItem('wa_signup_pending_code', pendingCode);
                }
                if (sessionData.waba_id || sessionData.phone_number_id) {
                    sessionStorage.setItem('wa_signup_session', JSON.stringify(sessionData));
                }
            } catch (e) { /* ignore */ }
        };

        const clearSignupState = () => {
            try {
                sessionStorage.removeItem('wa_signup_pending_code');
                sessionStorage.removeItem('wa_signup_session');
            } catch (e) { /* ignore */ }
        };

        const cleanup = () => {
            window.removeEventListener('message', onMetaMessage);
            window.removeEventListener('focus', onWindowFocus);
            document.removeEventListener('visibilitychange', onVisibilityChange);
            if (connectionPoll) {
                clearInterval(connectionPoll);
                connectionPoll = null;
            }
            if (cancelTimer) {
                clearTimeout(cancelTimer);
                cancelTimer = null;
            }
            if (focusRetryTimer) {
                clearTimeout(focusRetryTimer);
                focusRetryTimer = null;
            }
        };

        const ensureOAuthCodeAndExchange = () => {
            if (finished || codeRequestInFlight) {
                return;
            }
            if (pendingCode) {
                maybeExchange();
                return;
            }
            codeRequestInFlight = true;
            showSavingStatus();
            App.requestWaOAuthCode(cfg)
                .then((code) => {
                    codeRequestInFlight = false;
                    if (finished) {
                        return;
                    }
                    pendingCode = code;
                    codeReceivedAt = Date.now();
                    persistSignupState();
                    fetch('/api/whatsapp/oauth-debug-log.php', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ step: 'fb_login_code_retry', client_id: clientId }),
                    }).catch(() => {});
                    exchangeCode(code);
                })
                .catch(() => {
                    codeRequestInFlight = false;
                    if (finished) {
                        return;
                    }
                    App.finishWaEmbeddedSignup(clientId, sessionData, {
                        startUrl,
                        onSuccess: () => {
                            finished = true;
                            cleanup();
                            clearSignupState();
                            onSuccess();
                        },
                        onError: () => {
                            App.recoverWaSignupIfPending(clientId);
                        },
                    });
                });
        };

        const exchangeCode = (code) => {
            if (finished || !code) {
                return;
            }
            fetch('/api/whatsapp/exchange-token.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                    code,
                    client_id: clientId,
                    waba_id: sessionData.waba_id || '',
                    phone_number_id: sessionData.phone_number_id || '',
                    display_phone_number: sessionData.display_phone_number || '',
                }),
            })
                .then((r) => r.json())
                .then((data) => {
                    if (data.success) {
                        finished = true;
                        cleanup();
                        clearSignupState();
                        onSuccess();
                    } else {
                        onError(data.error || 'Connection failed');
                    }
                })
                .catch(() => onError('Network error while saving WhatsApp connection.'));
        };

        const maybeExchange = () => {
            if (!pendingCode || finished) {
                return;
            }
            const hasAssets = sessionData.waba_id || sessionData.phone_number_id;
            const waitedMs = Date.now() - codeReceivedAt;
            const waitEnough = metaFinishReceived ? waitedMs >= 1500 : waitedMs >= 12000;
            if (hasAssets || waitEnough) {
                exchangeCode(pendingCode);
            }
        };

        const onMetaMessage = (event) => {
            if (!metaOrigins.includes(event.origin)) {
                return;
            }
            let data = event.data;
            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (e) {
                    return;
                }
            }
            if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') {
                return;
            }
            if (App.isWaEmbeddedSignupFinish(data.event)) {
                metaFinishReceived = true;
                if (window.WaConnect && typeof window.WaConnect.onMetaFinish === 'function') {
                    window.WaConnect.onMetaFinish();
                }
                onMetaFinish();
                sessionData = App.parseWaEmbeddedSignupSession(data.data);
                fetch('/api/whatsapp/oauth-debug-log.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        step: 'meta_finish_sdk',
                        client_id: clientId,
                        event: data.event,
                        data: sessionData,
                    }),
                }).catch(() => {});
                persistSignupState();
                showSavingStatus();
                maybeExchange();
                if (!pendingCode) {
                    ensureOAuthCodeAndExchange();
                }
            }
            if (data.event === 'CANCEL') {
                if (!finished && !pendingCode) {
                    finished = true;
                    cleanup();
                    clearSignupState();
                    onError('WhatsApp signup cancelled.');
                }
            }
        };

        window.addEventListener('message', onMetaMessage);
        window.addEventListener('focus', onWindowFocus);
        document.addEventListener('visibilitychange', onVisibilityChange);

        connectionPoll = setInterval(() => {
            if (finished) {
                clearInterval(connectionPoll);
                connectionPoll = null;
                return;
            }
            App.fetchWaConnectionStatus().then((connected) => {
                if (connected) {
                    finished = true;
                    cleanup();
                    clearSignupState();
                    onSuccess();
                }
            });
        }, 1500);

        const startLogin = () => {
            if (window.WaConnect && typeof window.WaConnect.onMetaOpen === 'function') {
                window.WaConnect.onMetaOpen();
            } else {
                App.setWaConnectUiPhase('meta');
            }
            onSdkReady();
            FB.login((response) => {
                if (finished) {
                    return;
                }

                if (response.authResponse && response.authResponse.code) {
                    if (cancelTimer) {
                        clearTimeout(cancelTimer);
                        cancelTimer = null;
                    }
                    pendingCode = response.authResponse.code;
                    codeReceivedAt = Date.now();
                    persistSignupState();
                    fetch('/api/whatsapp/oauth-debug-log.php', {
                        method: 'POST',
                        credentials: 'same-origin',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ step: 'fb_login_code', client_id: clientId }),
                    }).catch(() => {});
                    setTimeout(maybeExchange, 800);
                    setTimeout(maybeExchange, 3000);
                    setTimeout(maybeExchange, 8000);
                    setTimeout(maybeExchange, 15000);
                    setTimeout(maybeExchange, 25000);
                    return;
                }

                // FB.login often fires once with unknown/connected before the popup finishes — do NOT abort.
                if (response.status === 'not_authorized') {
                    if (cancelTimer) {
                        clearTimeout(cancelTimer);
                    }
                    cancelTimer = setTimeout(() => {
                        if (finished || pendingCode || sessionData.waba_id) {
                            return;
                        }
                        finished = true;
                        cleanup();
                        clearSignupState();
                        onError('WhatsApp signup cancelled.');
                    }, 2000);
                    return;
                }

                // Popup still open or loading — keep listening for FINISH + code.
            }, {
                config_id: cfg.configId,
                response_type: 'code',
                override_default_response_type: true,
                extras: {
                    setup: {},
                    featureType: 'whatsapp_business_app_onboarding',
                    sessionInfoVersion: '3',
                    version: 'v4',
                },
            });
        };

        if (skipEnsure && typeof FB !== 'undefined' && window.fbSdkReady) {
            startLogin();
            return;
        }

        App.ensureFbSdkReady()
            .then(startLogin)
            .catch((err) => {
                cleanup();
                onError(err.message || 'Facebook SDK not loaded. Refresh the page and try again.');
            });
    },

    bindWhatsAppOAuthConnectButtons() {
        document.querySelectorAll('[data-wa-oauth-connect]').forEach((btn) => {
            if (btn.dataset.waOauthBound === '1') {
                return;
            }
            btn.dataset.waOauthBound = '1';

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const clientId = parseInt(btn.getAttribute('data-wa-client-id') || '0', 10);
                let startUrl = btn.getAttribute('data-wa-oauth-url') || '';
                const returnPath = btn.getAttribute('data-wa-return') || (window.location.pathname + window.location.search);
                const useFbSdk = clientId > 0 && window.metaWaSignup && window.metaWaSignup.appId;
                const isNative = App.isNativeApp();
                const isMobile = App.isMobileClient() || btn.getAttribute('data-wa-mobile') === '1';

                if (!startUrl && clientId > 0) {
                    startUrl = `/client/whatsapp-oauth-start?client_id=${clientId}&return=${encodeURIComponent(returnPath)}`;
                }

                if (!useFbSdk && !startUrl) {
                    return;
                }

                const sdkBlocked = window.fbSdkFailed || btn.dataset.waSdkFailed === '1';
                const useSdkPath = !isNative && !isMobile && useFbSdk && !sdkBlocked
                    && btn.dataset.waSdkReady === '1'
                    && window.fbSdkReady === true
                    && typeof FB !== 'undefined';

                const originalHtml = btn.innerHTML;
                btn.dataset.waOauthOriginalHtml = originalHtml;
                const statusEl = document.getElementById('wa-connect-status');

                App.setWaConnectUiPhase('connecting');
                App.markWaOAuthPending();

                fetch('/api/whatsapp/oauth-debug-log.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        step: 'connect_click',
                        client_id: clientId,
                        fbSdkReady: !!window.fbSdkReady,
                        fbSdkFailed: !!window.fbSdkFailed,
                        sdkBlocked,
                        useSdkPath,
                        startUrl,
                        flow: useSdkPath ? 'sdk' : 'popup',
                    }),
                }).catch(() => {});

                const resetButton = () => {
                    App.clearWaOAuthPending();
                    App.setWaConnectUiPhase('idle');
                };

                const onSuccess = () => {
                    App.clearWaOAuthPending();
                    if (window.WaConnect && typeof window.WaConnect.redirectConnected === 'function') {
                        window.WaConnect.redirectConnected();
                        return;
                    }
                    App.toast('WhatsApp connected!', 'success');
                    const dest = returnPath || '/client/dashboard?welcome=1';
                    const url = dest.indexOf('?') >= 0
                        ? dest + '&connected=1'
                        : dest + '?connected=1';
                    window.location.replace(url);
                };

                const oauthOpts = {
                    clientId,
                    startUrl,
                    onSuccess,
                    onMetaFinish: () => {
                        if (window.WaConnect && typeof window.WaConnect.onMetaFinish === 'function') {
                            window.WaConnect.onMetaFinish();
                        }
                        App.setWaConnectUiPhase('saving');
                    },
                    onError: (msg) => {
                        resetButton();
                        if (msg) {
                            App.toast(msg, 'error');
                        }
                    },
                    onClose: () => {
                        App.fetchWaConnectionStatus().then((connected) => {
                            if (connected) {
                                onSuccess();
                                return;
                            }
                            App.recoverWaSignupIfPending(clientId).then((recovered) => {
                                if (!recovered) {
                                    resetButton();
                                }
                            });
                        });
                    },
                };

                const openMetaPopup = () => {
                    App.setWaConnectUiPhase('meta');
                    const popupUrl = startUrl + (startUrl.includes('?') ? '&' : '?') + 'popup=1';
                    const ok = App.openWhatsAppOAuthPopup(popupUrl, oauthOpts);
                    if (!ok) {
                        resetButton();
                        App.toast('Popup blocked. Allow popups for iqpigeon.com and click Connect again.', 'error');
                    }
                };

                const runFbLogin = () => {
                    if (window.WaConnect && typeof window.WaConnect.onMetaOpen === 'function') {
                        window.WaConnect.onMetaOpen();
                    } else {
                        App.setWaConnectUiPhase('meta');
                    }
                    App.launchWhatsAppFbSignup(clientId, {
                        sdkReady: true,
                        startUrl,
                        onMetaFinish: oauthOpts.onMetaFinish,
                        onSuccess,
                        onError: (msg) => {
                            resetButton();
                            if (msg) {
                                App.toast(msg, 'error');
                            }
                        },
                    });
                };

                const redirectToMeta = () => {
                    if (startUrl) {
                        window.location.href = startUrl;
                        return;
                    }
                    resetButton();
                    App.toast('WhatsApp signup URL is missing.', 'error');
                };

                if (isNative || isMobile) {
                    redirectToMeta();
                    return;
                }

                if (useSdkPath) {
                    runFbLogin();
                    return;
                }

                openMetaPopup();
            });
        });
    },

    isMobileClient() {
        const ua = navigator.userAgent || '';
        const uaMatch = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua);
        const narrow = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        return uaMatch || narrow;
    },

    isNativeApp() {
        try {
            return typeof window.AndroidBridge !== 'undefined'
                && typeof window.AndroidBridge.isNativeApp === 'function'
                && window.AndroidBridge.isNativeApp();
        } catch (e) {
            return false;
        }
    },

    markWaOAuthPending() {
        try {
            sessionStorage.setItem('wa_oauth_pending', String(Date.now()));
        } catch (e) { /* ignore */ }
    },

    clearWaOAuthPending() {
        try {
            sessionStorage.removeItem('wa_oauth_pending');
        } catch (e) { /* ignore */ }
    },

    resetWaConnectButtons() {
        App.setWaConnectUiPhase('idle');
    },

    _waConnectionPollId: null,

    startWaConnectionPoll(onConnected) {
        if (App._waConnectionPollId) {
            return;
        }
        App._waConnectionPollId = setInterval(() => {
            let pending = null;
            try {
                pending = sessionStorage.getItem('wa_oauth_pending');
            } catch (e) {
                App.stopWaConnectionPoll();
                return;
            }
            if (!pending) {
                App.stopWaConnectionPoll();
                return;
            }
            const age = Date.now() - parseInt(pending, 10);
            if (Number.isNaN(age) || age > 30 * 60 * 1000) {
                App.clearWaOAuthPending();
                App.stopWaConnectionPoll();
                App.resetWaConnectButtons();
                return;
            }
            App.fetchWaConnectionStatus().then((connected) => {
                if (connected && onConnected) {
                    App.stopWaConnectionPoll();
                    onConnected();
                }
            });
        }, 2500);
    },

    stopWaConnectionPoll() {
        if (App._waConnectionPollId) {
            clearInterval(App._waConnectionPollId);
            App._waConnectionPollId = null;
        }
    },

    /** Retry saving WhatsApp after Meta popup closes (code/session in sessionStorage). */
    recoverWaSignupIfPending(clientId) {
        if (!clientId) {
            return Promise.resolve(false);
        }
        let code = null;
        let sessionData = {};
        try {
            code = sessionStorage.getItem('wa_signup_pending_code');
            const raw = sessionStorage.getItem('wa_signup_session');
            if (raw) {
                sessionData = JSON.parse(raw) || {};
            }
        } catch (e) {
            return Promise.resolve(false);
        }

        const finishSave = (authCode) => fetch('/api/whatsapp/exchange-token.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify({
                code: authCode,
                client_id: clientId,
                waba_id: sessionData.waba_id || '',
                phone_number_id: sessionData.phone_number_id || '',
                display_phone_number: sessionData.display_phone_number || '',
            }),
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.success) {
                    try {
                        sessionStorage.removeItem('wa_signup_pending_code');
                        sessionStorage.removeItem('wa_signup_session');
                    } catch (e) { /* ignore */ }
                    App.clearWaOAuthPending();
                    window.location.replace('/client/dashboard?welcome=1&connected=1');
                    return true;
                }
                return false;
            })
            .catch(() => false);

        if (code) {
            return finishSave(code);
        }

        const hasSession = sessionData.waba_id || sessionData.phone_number_id;
        if (hasSession) {
            return App.requestWaOAuthCode()
                .then((freshCode) => finishSave(freshCode))
                .catch(() => App.fetchWaConnectionStatus().then((connected) => {
                    if (connected) {
                        App.clearWaOAuthPending();
                        window.location.replace('/client/dashboard?welcome=1&connected=1');
                        return true;
                    }
                    return false;
                }));
        }

        return App.fetchWaConnectionStatus().then((connected) => {
            if (connected) {
                App.clearWaOAuthPending();
                window.location.replace('/client/dashboard?welcome=1&connected=1');
                return true;
            }
            return false;
        });
    },

    checkWaOAuthPending() {
        let pending = null;
        try {
            pending = sessionStorage.getItem('wa_oauth_pending');
        } catch (e) {
            return;
        }
        if (!pending) {
            App.stopWaConnectionPoll();
            return;
        }

        const age = Date.now() - parseInt(pending, 10);
        if (Number.isNaN(age) || age > 30 * 60 * 1000) {
            App.clearWaOAuthPending();
            App.resetWaConnectButtons();
            App.stopWaConnectionPoll();
            return;
        }

        const clientId = App.getWaConnectClientId();
        let hasSignupState = false;
        try {
            hasSignupState = !!(sessionStorage.getItem('wa_signup_pending_code')
                || sessionStorage.getItem('wa_signup_session'));
        } catch (e) { /* ignore */ }

        const statusEl = document.getElementById('wa-connect-status');
        if (statusEl && (hasSignupState || age < 120000)) {
            App.setWaConnectUiPhase('saving');
        }

        const redirectIfConnected = () => {
            App.fetchWaConnectionStatus().then((connected) => {
                if (connected) {
                    App.clearWaOAuthPending();
                    App.stopWaConnectionPoll();
                    const dest = '/client/dashboard?welcome=1&connected=1';
                    window.location.replace(dest);
                    return;
                }
                if (age > 20000 && !hasSignupState) {
                    App.clearWaOAuthPending();
                    App.resetWaConnectButtons();
                }
            }).catch(() => {
                if (age > 20000 && !hasSignupState) {
                    App.resetWaConnectButtons();
                }
            });
        };

        if (clientId > 0) {
            App.recoverWaSignupIfPending(clientId).then((recovered) => {
                if (!recovered) {
                    redirectIfConnected();
                }
            });
        } else {
            redirectIfConnected();
        }
        App.startWaConnectionPoll(redirectIfConnected);
    },
};

function formatRelativeTime(iso) {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return '';
    const diff = Math.max(0, Math.floor((Date.now() - then) / 1000));
    if (diff < 60) return 'Just now';
    const mins = Math.floor(diff / 60);
    if (diff < 3600) return mins === 1 ? '1 minute ago' : `${mins} minutes ago`;
    const hours = Math.floor(diff / 3600);
    if (diff < 86400) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    const days = Math.floor(diff / 86400);
    if (diff < 604800) return days === 1 ? '1 day ago' : `${days} days ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatLocalTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatLocalDayLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const startOf = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dDay = startOf(d).getTime();
    const today = startOf(now).getTime();
    const oneDay = 86400000;
    if (dDay === today) return 'Today';
    if (dDay === today - oneDay) return 'Yesterday';
    const opts = { month: 'short', day: 'numeric' };
    if (d.getFullYear() !== now.getFullYear()) {
        opts.year = 'numeric';
    }
    return d.toLocaleDateString(undefined, opts);
}

function refreshRelativeTimes() {
    document.querySelectorAll('[data-relative-time]').forEach((el) => {
        const iso = el.getAttribute('data-relative-time');
        if (!iso) return;
        el.textContent = formatRelativeTime(iso);
    });
}

function applyLocalTimes() {
    document.querySelectorAll('.js-local-time').forEach((el) => {
        const iso = el.getAttribute('data-iso') || el.getAttribute('datetime');
        if (!iso) return;
        const formatted = formatLocalTime(iso);
        if (formatted) el.textContent = formatted;
    });
    document.querySelectorAll('.js-local-day').forEach((el) => {
        const iso = el.getAttribute('data-iso');
        if (!iso) return;
        const formatted = formatLocalDayLabel(iso);
        if (formatted) el.textContent = formatted;
    });
}

document.addEventListener('click', (e) => {
    if (e.target.closest('#admin-sidebar-toggle')) {
        e.preventDefault();
        App.toggleAdminSidebar();
        return;
    }
    if (e.target.closest('#admin-sidebar-overlay')) {
        App.closeAdminSidebar();
        return;
    }
    if (e.target.closest('#admin-sidebar a')) {
        App.closeAdminSidebar();
        return;
    }
    if (e.target.closest('[data-mobile-menu-open]')) {
        e.preventDefault();
        App.openMobileMenu();
        return;
    }
    if (e.target.closest('[data-mobile-menu-close]')) {
        App.closeMobileMenu();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
        App.toast('Success!', 'success');
    }
    if (params.get('error')) {
        App.toast(decodeURIComponent(params.get('error')), 'error');
    }

    // Clear stuck modal scroll lock from a previous interaction
    const modalOpen = document.getElementById('app-confirm-modal')
        || document.querySelector('.bottom-sheet.open');
    if (!modalOpen && document.body.style.overflow === 'hidden') {
        document.body.style.overflow = '';
    }

    // Mobile bottom nav + menu drawer: move to body root (fixes overflow clipping on iOS)
    if (document.body.classList.contains('client-app')) {
        const mobileNav = document.getElementById('client-mobile-nav');
        if (mobileNav && mobileNav.parentElement !== document.body) {
            document.body.appendChild(mobileNav);
        }
        const menuOverlay = document.getElementById('client-mobile-menu-overlay');
        const menuDrawer = document.getElementById('client-mobile-menu');
        if (menuOverlay && menuOverlay.parentElement !== document.body) {
            document.body.appendChild(menuOverlay);
        }
        if (menuDrawer && menuDrawer.parentElement !== document.body) {
            document.body.appendChild(menuDrawer);
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && document.getElementById('client-mobile-menu')?.classList.contains('open')) {
            App.closeMobileMenu();
        }
        if (e.key === 'Escape' && document.getElementById('admin-sidebar')?.classList.contains('is-open')) {
            App.closeAdminSidebar();
        }
    });

    document.querySelectorAll('[data-password-toggle]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const wrap = btn.closest('.password-field, .auth-input-group--password, .auth-input-group');
            const input = wrap?.querySelector('[data-password-input]');
            const icon = btn.querySelector('[data-password-icon]');
            if (!input || !icon) return;
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            icon.textContent = show ? 'visibility_off' : 'visibility';
            btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
        });
    });

    refreshRelativeTimes();
    applyLocalTimes();
    setInterval(refreshRelativeTimes, 30000);

    App.bindWhatsAppOAuthConnectButtons();
    App.checkWaOAuthPending();
    App.initWaConnectPreload();

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            App.checkWaOAuthPending();
        }
    });
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            App.resetWaConnectButtons();
        }
        App.checkWaOAuthPending();
    });

    /* Leads live refresh handled by bot-sync.js version polling */

    if (document.body.classList.contains('admin-app')) {
        // Remove accidental plain-text key lines pasted into old PHP partials (OPcache stale copies).
        const leakKey = 'eanpGgeqevhhCpcieDEvAoeaEGPAhaXhHNvioejtCIXjGXJLBfOOdCmEFoDijMLX';
        [...document.body.childNodes].forEach((node) => {
            if (node.nodeType !== Node.TEXT_NODE) {
                return;
            }
            const text = node.textContent.trim();
            if (text === '' || text === leakKey || (text.length >= 32 && /^[A-Za-z0-9]+$/.test(text))) {
                node.remove();
            }
        });

        const adminOverlay = document.getElementById('admin-sidebar-overlay');
        const adminSidebar = document.getElementById('admin-sidebar');
        const adminToolbar = document.querySelector('.admin-toolbar');
        if (adminOverlay && adminOverlay.parentElement !== document.body) {
            document.body.appendChild(adminOverlay);
        }
        if (adminSidebar && adminSidebar.parentElement !== document.body) {
            document.body.appendChild(adminSidebar);
        }
        if (adminToolbar && adminToolbar.parentElement !== document.body) {
            document.body.appendChild(adminToolbar);
        }
    }
});
