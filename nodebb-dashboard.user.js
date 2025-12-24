// ==UserScript==
// @name         NodeBB Dashboard Integrated
// @namespace    http://tampermonkey.net/
// @version      0.3
// @description  מערכת ניהול פורומים: הזרקה לתפריט, גילוי אוטומטי, דשבורד מרכז
// @author       Gemini 3 Pro Preview
// @match        *://*/*
// @updateURL    https://github.com/The-Young-boy/nodebb-dashboard/raw/refs/heads/main/nodebb-dashboard.user.js
// @downloadURL  https://github.com/The-Young-boy/nodebb-dashboard/raw/refs/heads/main/nodebb-dashboard.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_addStyle
// @grant        unsafeWindow
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. הגדרות ---
    const STORAGE_KEY_SITES = 'nodebb_dashboard_sites_v03';
    const STORAGE_KEY_IGNORED = 'nodebb_dashboard_ignored_v03';
    const DASHBOARD_HASH = '#nodebb-dashboard';

    const DEFAULT_SITES = [
        { name: 'מתמחים.טופ', url: 'https://mitmachim.top' }
    ];

    // --- 2. ניהול נתונים ---
    function getSites() {
        const stored = GM_getValue(STORAGE_KEY_SITES);
        if (!stored) {
            saveSites(DEFAULT_SITES);
            return DEFAULT_SITES;
        }
        return JSON.parse(stored);
    }
    function saveSites(sites) { GM_setValue(STORAGE_KEY_SITES, JSON.stringify(sites)); }
    function getIgnored() { return JSON.parse(GM_getValue(STORAGE_KEY_IGNORED) || '[]'); }
    function addToIgnored(url) {
        const list = getIgnored();
        if (!list.includes(url)) {
            list.push(url);
            GM_setValue(STORAGE_KEY_IGNORED, JSON.stringify(list));
        }
    }

    // זיהוי NodeBB
    function isNodeBB() {
        try {
            return (unsafeWindow.config && unsafeWindow.ajaxify) ||
                   document.querySelector('meta[name="generator"][content="NodeBB"]');
        } catch(e) { return false; }
    }

    // חילוץ שם האתר הנקי
    function getSiteName() {
        try {
            // נסיון 1: שליפה מהקונפיגורציה של האתר
            if (unsafeWindow.config && unsafeWindow.config.siteTitle) {
                return unsafeWindow.config.siteTitle;
            }
        } catch(e) {}

        // נסיון 2: חילוץ מהכותרת (לקיחת החלק שאחרי ה-|)
        const parts = document.title.split('|');
        if (parts.length > 1) {
            return parts.pop().trim(); // החלק האחרון
        }
        return document.title.trim();
    }

    // --- 3. לוגיקה ראשית ---
    function init() {
        if (!isNodeBB()) return;

        // בדיקה אם אנחנו במצב דשבורד
        if (window.location.hash === DASHBOARD_HASH) {
            injectDashboard();
        }

        // האזנה לשינוי Hash
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

    // --- 4. הוספת כפתור לתפריט ---
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

    // --- 5. פופאפ גילוי אתר ---
    function showDiscoveryPopup(url) {
        if (document.getElementById('nodebb-popup')) return;
        const div = document.createElement('div');
        div.id = 'nodebb-popup';
        div.style.cssText = `position:fixed; bottom:20px; right:20px; background:white; padding:15px; border:1px solid #ccc; box-shadow:0 5px 20px rgba(0,0,0,0.2); z-index:999999; direction:rtl; width:280px; border-radius:8px; font-family:sans-serif; text-align:right;`;

        const title = getSiteName();

        div.innerHTML = `
            <div style="font-weight:bold; margin-bottom:10px;">זיהיתי פורום חדש!</div>
            <div style="font-size:13px; margin-bottom:10px;">להוסיף את <b>${title}</b> למרכז הפורומים?</div>
            <div style="display:flex; gap:10px;">
                <button id="p-yes" style="flex:1; background:#28a745; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">כן</button>
                <button id="p-no" style="flex:1; background:#dc3545; color:white; border:none; padding:5px; border-radius:4px; cursor:pointer;">לא</button>
            </div>
        `;
        document.body.appendChild(div);

        document.getElementById('p-yes').onclick = () => {
            const sites = getSites();
            sites.push({ name: title, url: url });
            saveSites(sites);
            div.remove();
            alert('האתר נוסף! רענן כדי לראות.');
            location.reload();
        };
        document.getElementById('p-no').onclick = () => {
            addToIgnored(url);
            div.remove();
        };
    }

    // --- 6. הזרקת הדשבורד ---
    function injectDashboard() {
        const contentDiv = document.getElementById('content');
        if (!contentDiv) {
            setTimeout(injectDashboard, 100);
            return;
        }

        document.title = "מרכז הפורומים";

        GM_addStyle(`
            #dash-wrapper { font-family: 'Assistant', sans-serif; direction: rtl; text-align: right; background: #fff; border-radius:4px; padding: 15px; min-height: 80vh; }
            #dash-wrapper * { box-sizing: border-box; }

            .dash-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #eee; padding-bottom:10px; }
            .dash-h-title { font-size: 1.5rem; font-weight: bold; color: #333; }

            .d-topic { display: flex; align-items: center; padding: 10px; border-bottom: 1px solid #f0f0f0; transition: background 0.2s; }
            .d-topic:hover { background: #f9f9f9; }

            .d-auth { width: 50px; flex-shrink: 0; text-align: center; position: relative; margin-left: 15px; }
            .d-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; }
            .d-letter { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 18px; }
            .d-icon { position: absolute; bottom: -2px; left: -2px; width: 18px; height: 18px; background: white; border-radius: 50%; border: 2px solid white; object-fit: contain; }

            .d-main { flex-grow: 1; min-width: 0; }
            .d-link { font-size: 1.1rem; font-weight: 600; color: #333; text-decoration: none; display: block; margin-bottom: 4px; }
            .d-link:hover { color: #007bff; text-decoration: none; }
            .d-meta { font-size: 0.85rem; color: #777; display: flex; gap: 8px; align-items: center; }
            .d-badge { background: #f0f0f0; padding: 2px 8px; border-radius: 12px; font-size: 0.8rem; display: flex; align-items: center; gap: 5px; }

            .d-teaser { width: 300px; flex-shrink: 0; border-right: 1px solid #eee; padding-right: 15px; margin-right: 10px; display: flex; flex-direction: column; justify-content: center; }
            @media (max-width: 991px) { .d-teaser { display: none; } }
            .t-meta { font-size: 0.8rem; color: #666; margin-bottom: 2px; display: flex; align-items: center; gap: 5px; }
            .t-txt { font-size: 0.85rem; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .t-avatar { width: 18px; height: 18px; border-radius: 50%; object-fit: cover; }

            .d-btn { padding: 5px 12px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-left: 5px; }
            .bg-blue { background: #007bff; color: white; }
            .bg-gray { background: #eee; color: #333; }

            .d-modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10500; display: none; justify-content: center; align-items: center; }
            .d-modal-box { background: white; width: 500px; padding: 20px; border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); }
        `);

        contentDiv.innerHTML = `
            <div id="dash-wrapper">
                <div class="dash-header">
                    <div class="dash-h-title"><i class="fa fa-layer-group text-primary"></i> נושאים שלא נקראו (כל האתרים)</div>
                    <div>
                        <button class="d-btn bg-gray" id="dash-set-btn"><i class="fa fa-cog"></i> הגדרות</button>
                        <button class="d-btn bg-blue" id="dash-ref-btn"><i class="fa fa-sync"></i> רענן</button>
                    </div>
                </div>
                <div id="dash-list">
                    <div style="text-align:center; padding:50px;"><i class="fa fa-spinner fa-spin fa-2x"></i><br>טוען...</div>
                </div>
            </div>

            <div id="dash-settings" class="d-modal">
                <div class="d-modal-box">
                    <h4>ניהול אתרים</h4>
                    <div id="dash-sites-ui" style="max-height:250px; overflow-y:auto; margin-bottom:15px; border:1px solid #eee; padding:5px;"></div>
                    <div style="display:flex; gap:5px;">
                        <input id="add-n" placeholder="שם" style="flex:1; padding:5px;">
                        <input id="add-u" placeholder="URL" style="flex:2; padding:5px; direction:ltr;">
                        <button id="add-b" class="d-btn bg-blue">הוסף</button>
                    </div>
                    <div style="margin-top:15px; text-align:left;">
                        <button id="close-s" class="d-btn bg-gray">סגור</button>
                    </div>
                </div>
            </div>
        `;

        loadDashboardContent();

        document.getElementById('dash-ref-btn').onclick = loadDashboardContent;
        document.getElementById('dash-set-btn').onclick = openSettings;
        document.getElementById('close-s').onclick = () => document.getElementById('dash-settings').style.display = 'none';
        document.getElementById('add-b').onclick = addSiteFromDash;

        window.addEventListener('popstate', () => {
            if (window.location.hash !== DASHBOARD_HASH) {
                location.reload();
            }
        });
    }

    // --- 7. טעינת נתונים ---
    async function loadDashboardContent() {
        const container = document.getElementById('dash-list');
        const sites = getSites();

        container.innerHTML = '<div style="text-align:center; padding:50px;"><i class="fa fa-spinner fa-spin fa-2x"></i></div>';

        const promises = sites.map(s => fetchUnread(s));
        const results = await Promise.all(promises);
        const all = [].concat(...results);

        all.sort((a,b) => new Date(b.lastposttimeISO) - new Date(a.lastposttimeISO));

        if (all.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:50px; color:green;">הכל נקרא!</div>';
            return;
        }

        container.innerHTML = '';
        all.forEach(t => {
            const author = t.user;
            const teaser = t.teaser;
            const tUser = teaser ? (teaser.user || t.user) : t.user;
            const domain = new URL(t.origin.url).hostname;
            const iconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;

            let authHtml = `<div class="d-letter" style="background:${author['icon:bgColor']||'#666'}">${author['icon:text']||'?'}</div>`;
            if (author.picture) {
                let pic = fixUrl(author.picture, t.origin.url);
                authHtml = `<img class="d-avatar orb-fix" data-src="${pic}">`;
            }

            let tImg = `<div style="width:18px; height:18px; border-radius:50%; background:${tUser['icon:bgColor']||'#666'}; display:inline-block;"></div>`;
            if (tUser.picture) {
                let pic = fixUrl(tUser.picture, t.origin.url);
                tImg = `<img class="t-avatar orb-fix" data-src="${pic}">`;
            }

            let txt = "אין תוכן";
            if (teaser && teaser.content) {
                const d = document.createElement('div');
                d.innerHTML = teaser.content;
                txt = d.innerText.trim() || "";
            }

            const row = document.createElement('div');
            row.className = 'd-topic';
            row.innerHTML = `
                <div class="d-auth">
                    <a href="${t.origin.url}/user/${author.userslug}" target="_blank" style="text-decoration:none; display:inline-block; position:relative;">
                        ${authHtml}
                        <img class="d-icon orb-fix" data-src="${iconUrl}" title="${t.origin.name}">
                    </a>
                </div>
                <div class="d-main">
                    <a href="${t.origin.url}/topic/${t.slug}" target="_blank" class="d-link">${t.title}</a>
                    <div class="d-meta">
                        <span class="d-badge">
                            <img src="${iconUrl}" style="width:14px; height:14px;" class="orb-fix" data-src="${iconUrl}">
                            ${t.origin.name}
                            <span style="color:#ccc">|</span>
                            <i class="fa ${t.category.icon}"></i> ${t.category.name}
                        </span>
                        <span><i class="fa fa-eye"></i> ${t.viewcount}</span>
                        <span><i class="fa fa-comment"></i> ${t.postcount}</span>
                        ${t.pinned ? '<i class="fa fa-thumbtack text-danger"></i>' : ''}
                        ${t.locked ? '<i class="fa fa-lock text-warning"></i>' : ''}
                    </div>
                </div>
                <div class="d-teaser">
                    <div class="t-meta">
                        ${tImg} <b>${tUser.username}</b> <span>• ${timeAgo(t.lastposttimeISO)}</span>
                    </div>
                    <div class="t-txt" title="${txt}">${txt}</div>
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
                headers: { "Content-Type": "application/json" },
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
            list.innerHTML += `
                <div style="display:flex; justify-content:space-between; padding:5px; border-bottom:1px solid #f0f0f0;">
                    <div><b>${s.name}</b> <br><small>${s.url}</small></div>
                    <button class="d-btn bg-gray remove-s" data-idx="${i}">X</button>
                </div>`;
        });
        document.querySelectorAll('.remove-s').forEach(b => {
            b.onclick = function() {
                const s = getSites(); s.splice(this.dataset.idx, 1); saveSites(s); openSettings();
            };
        });
        document.getElementById('dash-settings').style.display = 'flex';
    }

    function addSiteFromDash() {
        const n = document.getElementById('add-n').value;
        const u = document.getElementById('add-u').value.trim().replace(/\/$/, "");
        if (!u) return;
        let finalUrl = u.startsWith('http') ? u : 'https://' + u;
        const sites = getSites();
        if(!sites.some(s=>s.url===finalUrl)) {
            sites.push({ name: n||'אתר', url: finalUrl });
            saveSites(sites);
            openSettings();
            document.getElementById('add-n').value=''; document.getElementById('add-u').value='';
        }
    }

    function fixUrl(url, base) {
        if (!url.startsWith('http')) return base + (url.startsWith('/')?'':'/') + url;
        return url;
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
