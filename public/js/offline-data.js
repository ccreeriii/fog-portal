/**
 * Koinonia Offline Engine v2 — Phase A1
 * public/js/offline-data.js
 *
 * Native IndexedDB display cache for offline dashboard resilience.
 * DISPLAY CACHING ONLY — Never grants server authority or session authentication.
 */

(function(window) {
    'use strict';

    const DB_NAME = 'koinonia_offline_v2';
    const DB_VERSION = 1;
    const STORE_DASHBOARD = 'dashboard_snapshots';
    const STORE_PUBLIC = 'public_content';

    const FORBIDDEN_KEY_PATTERN = /(?:password|passcode|token|credential|secret|authorization|cookie|session|unique[_-]?pass[_-]?id|google[_-]?id|facebook[_-]?id)/i;

    let dbInstance = null;
    let isDbAvailable = typeof window.indexedDB !== 'undefined';
    let dbInitPromise = null;

    function sanitizeData(value, depth = 0) {
        if (depth > 6) return null;
        if (value === null || typeof value !== 'object') return value;
        if (Array.isArray(value)) {
            return value.map(item => sanitizeData(item, depth + 1));
        }
        const clean = {};
        for (const [k, v] of Object.entries(value)) {
            if (FORBIDDEN_KEY_PATTERN.test(k)) continue;
            if (typeof v === 'function') continue;
            clean[k] = sanitizeData(v, depth + 1);
        }
        return clean;
    }

    function validateOwnerKey(ownerKey) {
        if (typeof ownerKey !== 'string') return false;
        return /^member:[1-9]\d*$/.test(ownerKey);
    }

    function init() {
        if (!isDbAvailable) {
            return Promise.resolve(null);
        }
        if (dbInstance) {
            return Promise.resolve(dbInstance);
        }
        if (dbInitPromise) {
            return dbInitPromise;
        }

        dbInitPromise = new Promise((resolve) => {
            try {
                const request = window.indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    if (!db.objectStoreNames.contains(STORE_DASHBOARD)) {
                        db.createObjectStore(STORE_DASHBOARD, { keyPath: 'ownerKey' });
                    }
                    if (!db.objectStoreNames.contains(STORE_PUBLIC)) {
                        db.createObjectStore(STORE_PUBLIC, { keyPath: 'contentType' });
                    }
                };

                request.onsuccess = (event) => {
                    dbInstance = event.target.result;
                    dbInstance.onversionchange = () => {
                        dbInstance.close();
                        dbInstance = null;
                    };
                    resolve(dbInstance);
                };

                request.onerror = () => {
                    isDbAvailable = false;
                    resolve(null);
                };

                request.onblocked = () => {
                    resolve(null);
                };
            } catch (e) {
                isDbAvailable = false;
                resolve(null);
            }
        }).catch(() => {
            isDbAvailable = false;
            return null;
        });

        return dbInitPromise;
    }

    async function getStore(storeName, mode = 'readonly') {
        const db = await init();
        if (!db) return null;
        try {
            const tx = db.transaction(storeName, mode);
            return tx.objectStore(storeName);
        } catch (e) {
            return null;
        }
    }

    const KoinoniaOfflineData = {
        init,

        isAvailable: function() {
            return isDbAvailable && Boolean(window.indexedDB);
        },

        saveDashboardSnapshot: async function(ownerKey, patch) {
            if (!validateOwnerKey(ownerKey) || !patch || typeof patch !== 'object') {
                return false;
            }
            try {
                const store = await getStore(STORE_DASHBOARD, 'readwrite');
                if (!store) return false;

                const canonicalMemberId = parseInt(ownerKey.replace('member:', ''), 10);
                const existing = await new Promise((resolve) => {
                    const req = store.get(ownerKey);
                    req.onsuccess = () => resolve(req.result || null);
                    req.onerror = () => resolve(null);
                });

                const cleanPatch = sanitizeData(patch);
                const snapshot = {
                    ...(existing || {}),
                    ...cleanPatch,
                    ownerKey: ownerKey,
                    canonicalMemberId: canonicalMemberId,
                    capturedAt: Date.now()
                };

                return await new Promise((resolve) => {
                    const putReq = store.put(snapshot);
                    putReq.onsuccess = () => resolve(true);
                    putReq.onerror = () => resolve(false);
                });
            } catch (e) {
                return false;
            }
        },

        getDashboardSnapshot: async function(ownerKey) {
            if (!validateOwnerKey(ownerKey)) return null;
            try {
                const store = await getStore(STORE_DASHBOARD, 'readonly');
                if (!store) return null;

                return await new Promise((resolve) => {
                    const req = store.get(ownerKey);
                    req.onsuccess = () => {
                        const res = req.result;
                        if (!res) {
                            resolve(null);
                            return;
                        }
                        if (res.ownerKey !== ownerKey) {
                            resolve(null);
                            return;
                        }
                        resolve(res);
                    };
                    req.onerror = () => resolve(null);
                });
            } catch (e) {
                return null;
            }
        },

        savePublicContent: async function(contentType, data) {
            if (!contentType || typeof contentType !== 'string' || !data) {
                return false;
            }
            try {
                const store = await getStore(STORE_PUBLIC, 'readwrite');
                if (!store) return false;

                const record = {
                    contentType: String(contentType).trim(),
                    data: sanitizeData(data),
                    updatedAt: Date.now()
                };

                return await new Promise((resolve) => {
                    const req = store.put(record);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                });
            } catch (e) {
                return false;
            }
        },

        getPublicContent: async function(contentType) {
            if (!contentType || typeof contentType !== 'string') return null;
            try {
                const store = await getStore(STORE_PUBLIC, 'readonly');
                if (!store) return null;

                return await new Promise((resolve) => {
                    const req = store.get(String(contentType).trim());
                    req.onsuccess = () => resolve(req.result ? req.result.data : null);
                    req.onerror = () => resolve(null);
                });
            } catch (e) {
                return null;
            }
        },

        clearUserCache: async function(ownerKey) {
            if (!validateOwnerKey(ownerKey)) return false;
            try {
                const store = await getStore(STORE_DASHBOARD, 'readwrite');
                if (!store) return false;

                return await new Promise((resolve) => {
                    const req = store.delete(ownerKey);
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                });
            } catch (e) {
                return false;
            }
        },

        clearAllPersonalCache: async function() {
            try {
                const store = await getStore(STORE_DASHBOARD, 'readwrite');
                if (!store) return false;

                return await new Promise((resolve) => {
                    const req = store.clear();
                    req.onsuccess = () => resolve(true);
                    req.onerror = () => resolve(false);
                });
            } catch (e) {
                return false;
            }
        }
    };

    window.KoinoniaOfflineData = KoinoniaOfflineData;

    if (typeof window !== 'undefined' && window.indexedDB) {
        init().catch(() => {});
    }
})(window);
