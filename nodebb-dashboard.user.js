// ==UserScript==
// @name         NodeBB Dashboard Integrated - FULL & SECURED
// @namespace    http://tampermonkey.net/
// @version      0.3.4
// @description  מערכת ניהול פורומים: הזרקה לתפריט, דשבורד מרכז (תיקון Bootstrap + הגנת XSS מלאה)
// @author       Gemini 3 Pro Preview (Security Patch)
// @match        *://*/*
// @updateURL    https://github.com/The-Young-boy/nodebb-dashboard/raw/refs/heads/main/nodebb-dashboard.user.js
// @downloadURL  https://github.com/The-Young-boy/nodebb-dashboard/raw/refs/heads/main/nodebb-dashboard.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      icons.duckduckgo.com
// @connect      cdn-icons-png.flaticon.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- 0. פונקציות אבטחה (מניעת פריצות XSS) ---
    function esc(str) {
        if (!str) return '';
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
        return String(str).replace(/[&<>"']/g, m => map[m]);
    }

    function safeStripHTML(html) {
        if (!html) return "";
        try {
            const doc = new DOMParser().parseFromString(html, 'text/html');
            return doc.body.textContent || "";
        } catch(e) { return ""; }
    }

    // --- 1. הגדרות ---
    const STORAGE_KEY_SITES = 'nodebb_dashboard_sites_v03';
    const STORAGE_KEY_IGNORED = 'nodebb_dashboard_ignored_v03';
    const DASHBOARD_HASH = '#nodebb-dashboard';

    const DEFAULT_SITES = [
        { name: 'מתמחים', url: 'https://mitmachim.top' }
    ];

    // --- 2. ניהול נתונים ---
    function getSites() {
        const stored = GM_getValue(STORAGE_KEY_SITES);
        if (!stored) {
            saveSites(DEFAULT_SITES);
            return DEFAULT_SITES;
        }
        try { return JSON.parse(stored); } catch(e) { return DEFAULT_SITES; }
    }
    function saveSites(sites) { GM_setValue(STORAGE_KEY_SITES, JSON.stringify(sites)); }
    function getIgnored() { try { return JSON.parse(GM_getValue(STORAGE_KEY_IGNORED) || '[]'); } catch(e) { return []; } }
    function addToIgnored(url) {
        const list = getIgnored();
        if (!list.includes(url)) {
            list.push(url);
            GM_setValue(STORAGE_KEY_IGNORED, JSON.stringify(list));
        }
    }

    function isNodeBB() {
        try {
            return (unsafeWindow.config && unsafeWindow.ajaxify) ||
                   document.querySelector('meta[name="generator"][content="NodeBB"]');
        } catch(e) { return false; }
    }

    function getSiteName() {
        try {
            if (unsafeWindow.config && unsafeWindow.config.siteTitle) {
                return unsafeWindow.config.siteTitle;
            }
        } catch(e) {}
        const parts = document.title.split('|');
        if (parts.length > 1) return parts.pop().trim();
        return document.title.trim();
    }

    // --- 3. לוגיקה ראשית ---
    function init() {
        if (!isNodeBB()) return;

        if (window.location.hash === DASHBOARD_HASH) {
            injectDashboard();
        }

        window.addEventListener('hashchange', () => {
            if (window.location.hash === DASHBOARD_HASH) {
                location.reload();
            }
        });

        const currentUrl = window.location.origin;
        const sites = getSites();
        const isMySite = sites.some(s => s.url === currentUrl);

        if (isMySite) {
            ensureMenuButton();
        } else {
            const ignored = getIgnored();
            if (!ignored.includes(currentUrl) && window.location.hash !== DASHBOARD_HASH) {
                showDiscoveryPopup(currentUrl);
            }
        }
    }

    function ensureMenuButton() {
        setInterval(() => {
            if (document.getElementById('nodebb-dash-link')) return;
            const nav = document.querySelector('#main-nav') || document.querySelector('.navbar-nav');
            if (nav) {
                const li = document.createElement('li');
                li.className = 'nav-item';
                li.innerHTML = `
                    <a class="nav-link navigation-link" href="${DASHBOARD_HASH}" id="nodebb-dash-link" title="מרכז הפורומים">
                        <i class="fa fa-fw fa-cubes"></i>
                        <span class="visible-xs-inline">מרכז הפורומים</span>
                    </a>
                `;
                const ref = nav.querySelector('a[href="/unread"]');
                if (ref && ref.parentElement) ref.parentElement.after(li);
                else nav.appendChild(li);
            }
        }, 1500);
    }

    function showDiscoveryPopup(url) {
        if (document.getElementById('ndb-popup')) return;
        const rawTitle = getSiteName();
        const div = document.createElement('div');
        div.id = 'ndb-popup';
        div.style.cssText = `position:fixed; bottom:20px; right:20px; background:white; padding:15px; border:1px solid #ccc; box-shadow:0 5px 20px rgba(0,0,0,0.2); z-index:999999; direction:rtl; width:280px; border-radius:8px; font-family:sans-serif; text-align:right;`;

        div.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px;">זיהיתי פורום חדש!</div>
            <div style="font-size:13px; margin-bottom:10px;">להוסיף את <b>${esc(rawTitle)}</b> למרכז הפורומים?</div>
            <div style="display:flex; gap:10px;">
                <button id="p-yes" style="flex:1; background:#28a745; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">כן</button>
                <button id="p-no" style="flex:1; background:#dc3545; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">לא</button>
            </div>
        `;
        document.body.appendChild(div);

        document.getElementById('p-yes').onclick = () => {
            const sites = getSites();
            sites.push({ name: safeStripHTML(rawTitle).trim().slice(0,150), url: url });
            saveSites(sites);
            div.remove();
            location.reload();
        };
        document.getElementById('p-no').onclick = () => {
            addToIgnored(url);
            div.remove();
        };
    }

    function injectDashboard() {
        const contentDiv = document.getElementById('content');
        if (!contentDiv) {
            setTimeout(injectDashboard, 100);
            return;
        }

        document.title = "מרכז הפורומים";
        const link = document.querySelector("link[rel*='icon']") || document.createElement('link');
        link.type = 'image/x-icon'; link.rel = 'shortcut icon'; link.href = 'https://cdn-icons-png.flaticon.com/512/9966/9966469.png';
        document.head.appendChild(link);

        GM_addStyle(`
            @import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700&display=swap');
            #nbd-root { font-family: 'Assistant', sans-serif; font-size: 16px; direction: rtl; text-align: right; background: #fff; border-radius: 4px; padding: 15px; min-height: 80vh; width: 100%; }
            .nbd-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:10px; }
            .nbd-topic { display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #f0f0f0; transition: background 0.2s; }
            .nbd-topic:hover { background: #f9f9f9; }
            .nbd-auth { width: 50px; flex-shrink: 0; text-align: center; position: relative; margin-left: 15px; }
            .nbd-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; }
            .nbd-letter { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; }
            .nbd-icon { position: absolute; bottom: -2px; left: -2px; width: 18px; height: 18px; background: white; border-radius: 50%; border: 2px solid white; object-fit: contain; }
            .nbd-main { flex-grow: 1; min-width: 0; }
            .nbd-link { font-size: 18px; font-weight: 600; color: #333; text-decoration: none; display: block; margin-bottom: 4px; }
            .nbd-meta { font-size: 13px; color: #777; display: flex; gap: 8px; align-items: center; }
            .nbd-badge { background: #f0f0f0; padding: 2px 8px; border-radius: 12px; font-size: 13px; display: flex; align-items: center; gap: 5px; }
            .nbd-teaser { width: 300px; flex-shrink: 0; border-right: 1px solid #eee; padding-right: 15px; margin-right: 10px; display: flex; flex-direction: column; justify-content: center; }
            @media (max-width: 991px) { .nbd-teaser { display: none; } }
            .nbd-btn { padding: 5px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 5px; }
            .nbd-bg-blue { background: #007bff; color: white; }
            .nbd-bg-gray { background: #eee; color: #333; }
            .nbd-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10500; display: none; justify-content: center; align-items: center; }
            .nbd-modal-box { background: white; width: 500px; padding: 20px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        `);

        contentDiv.innerHTML = `
            <div id="nbd-root">
                <div class="nbd-header">
                    <div class="nbd-h-title">נושאים שלא נקראו (כל האתרים)</div>
                    <div>
                        <button class="nbd-btn nbd-bg-gray" id="dash-set-btn">הגדרות</button>
                        <button class="nbd-btn nbd-bg-blue" id="dash-ref-btn">רענן</button>
                    </div>
                </div>
                <div id="dash-list"></div>
            </div>
            <div id="dash-settings" class="nbd-modal">
                <div class="nbd-modal-box">
                    <h4>ניהול אתרים</h4>
                    <div id="dash-sites-ui" style="max-height:250px; overflow-y:auto; margin-bottom:15px; border:1px solid #eee; padding:5px;"></div>
                    <div style="display:flex; gap:5px;">
                        <input id="add-n" placeholder="שם" style="flex:1; padding:5px;">
                        <input id="add-u" placeholder="URL" style="flex:2; padding:5px; direction:ltr;">
                        <button id="add-b" class="nbd-btn nbd-bg-blue">הוסף</button>
                    </div>
                    <div style="margin-top:15px; text-align:left;"><button id="close-s" class="nbd-btn nbd-bg-gray">סגור</button></div>
                </div>
            </div>
        `;

        loadDashboardContent();
        document.getElementById('dash-ref-btn').onclick = loadDashboardContent;
        document.getElementById('dash-set-btn').onclick = openSettings;
        document.getElementById('close-s').onclick = () => document.getElementById('dash-settings').style.display = 'none';
        document.getElementById('add-b').onclick = addSiteFromDash;
    }

    async function loadDashboardContent() {
        const container = document.getElementById('dash-list');
        const sites = getSites();
        container.innerHTML = '<div style="text-align:center; padding:50px;">טוען...</div>';

        const results = await Promise.all(sites.map(s => fetchUnread(s)));
        const all = [].concat(...results).sort((a,b) => new Date(b.lastposttimeISO) - new Date(a.lastposttimeISO));

        if (all.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:50px;">הכל נקרא!</div>';
            return;
        }

        container.innerHTML = '';
        all.forEach(t => {
            const author = t.user || {};
            const teaser = t.teaser;
            const tUser = teaser ? (teaser.user || t.user) : t.user;
            const domain = new URL(t.origin.url).hostname;
            const iconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;

            let authHtml = `<div class="nbd-letter" style="background:${esc(author['icon:bgColor']||'#666')}">${esc(author['icon:text']||'?')}</div>`;
            if (author.picture) authHtml = `<img class="nbd-avatar orb-fix" data-src="${fixUrl(author.picture, t.origin.url)}">`;

            let tImg = `<div style="width:18px; height:18px; border-radius:50%; background:${esc(tUser['icon:bgColor']||'#666')}; display:inline-block;"></div>`;
            if (tUser.picture) tImg = `<img class="nbd-t-avatar orb-fix" data-src="${fixUrl(tUser.picture, t.origin.url)}">`;

            const cleanTeaser = teaser ? safeStripHTML(teaser.content) : "אין תוכן";

            const row = document.createElement('div');
            row.className = 'nbd-topic';
            row.innerHTML = `
                <div class="nbd-auth">
                    <a href="${t.origin.url}/user/${esc(author.userslug)}" target="_blank" style="text-decoration:none; display:inline-block; position:relative;">
                        ${authHtml}
                        <img class="nbd-icon orb-fix" data-src="${iconUrl}">
                    </a>
                </div>
                <div class="nbd-main">
                    <a href="${t.origin.url}/topic/${esc(t.slug)}" target="_blank" class="nbd-link">${esc(t.title)}</a>
                    <div class="nbd-meta">
                        <span class="nbd-badge"><img src="${iconUrl}" style="width:14px;"> ${esc(t.origin.name)} | ${esc(t.category.name)}</span>
                        <span><i class="fa fa-comment"></i> ${t.postcount}</span>
                    </div>
                </div>
                <div class="nbd-teaser">
                    <div class="nbd-t-meta">${tImg} <b>${esc(tUser.username)}</b> <span>• ${timeAgo(t.lastposttimeISO)}</span></div>
                    <div class="nbd-t-txt">${esc(cleanTeaser)}</div>
                </div>
            `;
            container.appendChild(row);
        });
        document.querySelectorAll('.orb-fix').forEach(img => loadSecureImage(img.getAttribute('data-src'), img));
    }

    function fetchUnread(site) {
        return new Promise(resolve => {
            GM_xmlhttpRequest({
                method: "GET",
                url: site.url.replace(/\/$/, "") + '/api/unread',
                onload: (res) => {
                    try {
                        const json = JSON.parse(res.responseText);
                        resolve((json.topics || []).map(t => ({ ...t, origin: site })));
                    } catch(e) { resolve([]); }
                },
                onerror: () => resolve([])
            });
        });
    }

    function openSettings() {
        const list = document.getElementById('dash-sites-ui');
        list.innerHTML = '';
        getSites().forEach((s, i) => {
            const div = document.createElement('div');
            div.style.cssText = "display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #eee;";
            div.innerHTML = `<div><b>${esc(s.name)}</b><br><small>${esc(s.url)}</small></div>`;
            const del = document.createElement('button');
            del.className = "nbd-btn nbd-bg-gray"; del.textContent = "X";
            del.onclick = () => { const sites = getSites(); sites.splice(i, 1); saveSites(sites); openSettings(); };
            div.appendChild(del);
            list.appendChild(div);
        });
        document.getElementById('dash-settings').style.display = 'flex';
    }

    function addSiteFromDash() {
        const n = document.getElementById('add-n').value;
        const u = document.getElementById('add-u').value.trim();
        if (!u) return;
        const sites = getSites();
        sites.push({ name: n||'אתר', url: u.startsWith('http') ? u : 'https://' + u });
        saveSites(sites);
        openSettings();
        document.getElementById('add-n').value=''; document.getElementById('add-u').value='';
    }

    function fixUrl(url, base) {
        if (!url || url.startsWith('http')) return url;
        return base + (url.startsWith('/') ? '' : '/') + url;
    }

    function loadSecureImage(url, img) {
        if(!url) return;
        GM_xmlhttpRequest({
            method: "GET", url: url, responseType: "blob",
            onload: (res) => {
                if(res.status===200) {
                    const reader = new FileReader();
                    reader.onloadend = () => { img.src = reader.result; };
                    reader.readAsDataURL(res.response);
                }
            }
        });
    }

    function timeAgo(d) {
        const diff = (new Date() - new Date(d)) / 1000;
        if(diff<60) return 'עכשיו';
        if(diff<3600) return Math.floor(diff/60) + ' דק\'';
        if(diff<86400) return Math.floor(diff/3600) + ' שע\'';
        return Math.floor(diff/86400) + ' ימים';
    }

    init();
})();
