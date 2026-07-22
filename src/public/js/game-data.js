(() => {
    'use strict';

    const CONFIG = {
        monsters: {
            label: 'モンスター',
            endpoint: '/api/admin/monsters',
            storageKey: 'tomocafe.admin.monsters.columns',
            columns: [
                { key: 'name', label: '名前', icon: 'T', width: 240, required: true, editable: true },
                { key: 'id', label: 'ID', icon: '#', width: 190, editable: true },
                { key: 'image', label: '画像', icon: '▧', width: 72 },
                { key: 'hp', label: 'HP', icon: '№', width: 100, editable: true },
                { key: 'rarity', label: 'レアリティ', icon: '◇', width: 130, editable: true },
                { key: 'drops', label: 'ドロップ', icon: '☷', width: 220, editable: true },
                { key: 'location', label: '出現場所', icon: '⌖', width: 160, editable: true },
                { key: 'enabled', label: '有効状態', icon: '✓', width: 100, editable: true },
                { key: 'updatedAt', label: '更新日時', icon: '◷', width: 160 },
                { key: 'menu', label: '', icon: '', width: 44 }
            ],
            rarityOptions: ['common', 'uncommon', 'rare', 'boss']
        },
        items: {
            label: 'アイテム',
            endpoint: '/api/admin/items',
            storageKey: 'tomocafe.admin.items.columns',
            columns: [
                { key: 'name', label: '名前', icon: 'T', width: 240, required: true, editable: true },
                { key: 'id', label: 'ID', icon: '#', width: 190, editable: true },
                { key: 'image', label: '画像', icon: '▧', width: 72 },
                { key: 'category', label: 'カテゴリ', icon: '⌑', width: 130, editable: true },
                { key: 'rarity', label: 'レアリティ', icon: '◇', width: 130, editable: true },
                { key: 'description', label: '説明', icon: '¶', width: 260, editable: true },
                { key: 'source', label: '入手方法', icon: '↗', width: 160, editable: true },
                { key: 'enabled', label: '有効状態', icon: '✓', width: 100, editable: true },
                { key: 'updatedAt', label: '更新日時', icon: '◷', width: 160 },
                { key: 'menu', label: '', icon: '', width: 44 }
            ],
            rarityOptions: ['ノーマル', 'レア', 'スーパーレア', 'ウルトラレア']
        }
    };
    const MECHANIC_PATTERNS = ['heavy_attack_warning', 'weakness_exposure', 'interruptible', 'summon', 'item_weakness'];

    const $ = (selector) => document.querySelector(selector);
    const els = {
        tabs: [...document.querySelectorAll('.view-tab')],
        head: $('#table-head'), body: $('#table-body'), error: $('#table-error'), errorMessage: $('#table-error-message'),
        search: $('#table-search'), searchControl: $('#search-control'), searchToggle: $('#search-toggle'), searchClose: $('#search-close'),
        filterToggle: $('#filter-toggle'), filterPopover: $('#filter-popover'), sortToggle: $('#sort-toggle'), sortPopover: $('#sort-popover'),
        columnsToggle: $('#columns-toggle'), columnsPopover: $('#columns-popover'), reload: $('#reload-data'), newRecord: $('#new-record'),
        detail: $('#detail-panel'), detailForm: $('#detail-form'), detailClose: $('#detail-close'), detailCloseDesktop: $('#detail-close-desktop'),
        imagePreview: $('#image-preview'), previewImage: $('#preview-image'), dropPopover: $('#drop-popover'), deleteDialog: $('#delete-dialog'),
        deleteCancel: $('#delete-cancel'), deleteConfirm: $('#delete-confirm'), retry: $('#retry-data')
    };
    const params = new URLSearchParams(window.location.search);
    const initialView = params.get('view') === 'items' ? 'items' : 'monsters';
    const state = {
        view: initialView,
        records: [],
        pagination: { total: 0 },
        loading: false,
        error: '',
        search: params.get('search') || '',
        filters: { rarity: params.get('rarity') || '', enabled: params.get('enabled') || '', category: params.get('category') || '', minHp: params.get('minHp') || '', maxHp: params.get('maxHp') || '' },
        sort: { key: params.get('sort') || 'updatedAt', direction: params.get('direction') === 'asc' ? 'asc' : 'desc' },
        visibleColumns: loadColumns(initialView),
        selectedId: null,
        editing: null,
        savedCell: null,
        deletingId: null,
        requestController: null
    };
    let searchTimer;

    function loadColumns(view) {
        const defaults = CONFIG[view].columns.map((column) => column.key);
        try {
            const saved = JSON.parse(localStorage.getItem(CONFIG[view].storageKey));
            return Array.isArray(saved) ? defaults.filter((key) => saved.includes(key) || key === 'name' || key === 'menu') : defaults;
        } catch (_) { return defaults; }
    }
    function saveColumns() {
        localStorage.setItem(CONFIG[state.view].storageKey, JSON.stringify(state.visibleColumns));
    }
    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
    }
    function escapeAttribute(value) { return escapeHtml(value); }
    function safeImageUrl(value) {
        if (!value || typeof value !== 'string') return '';
        try {
            const url = new URL(value, window.location.origin);
            return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
        } catch (_) { return ''; }
    }
    function recordId(record) { return record._id; }
    function getName(record) { return state.view === 'monsters' ? record.name_ja : record.title; }
    function getExternalId(record) { return state.view === 'monsters' ? record.monster_id : record.item_id; }
    function currentConfig() { return CONFIG[state.view]; }
    function shownColumns() { return currentConfig().columns.filter((column) => state.visibleColumns.includes(column.key)); }
    function updateUrl() {
        const next = new URLSearchParams();
        if (state.view !== 'monsters') next.set('view', state.view);
        if (state.search) next.set('search', state.search);
        Object.entries(state.filters).forEach(([key, value]) => { if (value) next.set(key, value); });
        if (state.sort.key !== 'updatedAt') next.set('sort', state.sort.key);
        if (state.sort.direction !== 'desc') next.set('direction', state.sort.direction);
        const query = next.toString();
        window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    }
    function activeFilterCount() { return Object.values(state.filters).filter(Boolean).length; }
    function updateFilterCount() {
        const count = activeFilterCount();
        const node = els.filterToggle.querySelector('.toolbar-count');
        node.hidden = count === 0;
        node.textContent = count || '';
        els.filterToggle.setAttribute('aria-label', count ? `フィルター ${count}件適用中` : 'フィルター');
    }
    function apiUrl() {
        const query = new URLSearchParams({ limit: '100', sort: state.sort.key, direction: state.sort.direction });
        if (state.search) query.set('search', state.search);
        Object.entries(state.filters).forEach(([key, value]) => { if (value) query.set(key, value); });
        return `${currentConfig().endpoint}?${query}`;
    }
    async function request(url, options = {}) {
        const response = await fetch(url, { headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
        if (response.status === 204) return null;
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || '操作に失敗しました。');
        return result;
    }
    async function loadRecords() {
        if (state.requestController) state.requestController.abort();
        state.requestController = new AbortController();
        state.loading = true; state.error = ''; renderTable();
        try {
            const result = await request(apiUrl(), { signal: state.requestController.signal });
            state.records = result.data || [];
            state.pagination = result.pagination || { total: state.records.length };
        } catch (error) {
            if (error.name !== 'AbortError') state.error = error.message || 'データの取得に失敗しました。';
        } finally { state.loading = false; renderTable(); }
    }
    function renderTable() {
        const columns = shownColumns();
        els.head.innerHTML = `<tr>${columns.map(renderHeader).join('')}</tr>`;
        els.error.hidden = !state.error;
        els.errorMessage.textContent = state.error;
        if (state.loading) {
            els.body.innerHTML = renderSkeleton(columns.length);
            return;
        }
        if (state.error) {
            els.body.innerHTML = messageRow(columns.length, 'データを読み込めませんでした', '上部の再試行ボタンでもう一度お試しください。');
            return;
        }
        if (!state.records.length) {
            const hasConditions = Boolean(state.search || activeFilterCount());
            els.body.innerHTML = messageRow(columns.length,
                hasConditions ? `条件に一致する${currentConfig().label}はありません` : `${currentConfig().label}がまだ登録されていません`,
                hasConditions ? '検索条件またはフィルターを変更してください' : '「新規作成」から最初のデータを追加できます');
            return;
        }
        els.body.innerHTML = `${state.records.map((record) => renderRow(record, columns)).join('')}${renderAddRow(columns.length)}`;
    }
    function renderHeader(column) {
        if (column.key === 'menu') return '<th aria-label="行メニュー"></th>';
        const sortKey = ({ name: 'name', id: 'id', hp: 'hp', rarity: 'rarity', updatedAt: 'updatedAt' })[column.key];
        const indicator = sortKey === state.sort.key ? `<span class="sort-indicator" aria-hidden="true">${state.sort.direction === 'asc' ? '↑' : '↓'}</span>` : '';
        return `<th class="${responsiveColumnClass(column.key)}" style="width:${column.width}px">${sortKey ? `<button type="button" class="header-button" data-sort="${sortKey}" aria-label="${escapeAttribute(column.label)}で並べ替え">` : '<span class="header-button">'}<span class="header-icon" aria-hidden="true">${column.icon}</span>${escapeHtml(column.label)}${indicator}${sortKey ? '</button>' : '</span>'}</th>`;
    }
    function renderSkeleton(count) {
        const cells = Array.from({ length: count }, (_, index) => `<td><div class="skeleton" style="width:${index === 0 ? '70' : '55'}%"></div></td>`).join('');
        return Array.from({ length: 5 }, () => `<tr class="skeleton-row">${cells}</tr>`).join('');
    }
    function messageRow(count, title, message) { return `<tr class="table-message"><td colspan="${count}"><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</td></tr>${renderAddRow(count)}`; }
    function renderAddRow(count) { return `<tr class="add-row"><td colspan="${count}"><button type="button" data-action="new-record">＋ 新規作成</button></td></tr>`; }
    function responsiveColumnClass(key) {
        return ['image', 'drops', 'location', 'description', 'source', 'updatedAt'].includes(key) ? 'hide-mobile' : (key === 'rarity' ? 'hide-tablet' : '');
    }
    function renderRow(record, columns) {
        const id = recordId(record);
        const selected = state.selectedId === id;
        return `<tr class="data-row${selected ? ' is-selected' : ''}" data-record-id="${escapeAttribute(id)}" data-selected="${selected}" tabindex="0">${columns.map((column) => `<td class="${responsiveColumnClass(column.key)}" title="${cellTitle(record, column.key)}">${renderCell(record, column)}</td>`).join('')}</tr>`;
    }
    function cellTitle(record, key) {
        const values = { name: getName(record), id: getExternalId(record), hp: record.battle?.max_hp ?? record.market_price, location: record.category, category: record.category, description: record.description, source: sourceValue(record), updatedAt: fullDate(record.updatedAt), drops: dropValues(record).join(', ') };
        return escapeAttribute(values[key] ?? '');
    }
    function renderCell(record, column) {
        const editing = state.editing && state.editing.id === recordId(record) && state.editing.key === column.key;
        if (editing) return renderEditControl(record, column);
        switch (column.key) {
            case 'name': return `<span class="name-cell cell-main editable-value" data-edit="name">${safeImageUrl(record.image_url) ? `<img class="tiny-thumb" src="${escapeAttribute(safeImageUrl(record.image_url))}" alt="" loading="lazy">` : ''}<span>${escapeHtml(getName(record))}</span>${savedMark(record, column.key)}</span>`;
            case 'id': return `<span class="id-cell"><span class="mono editable-value" data-edit="id">${escapeHtml(getExternalId(record))}</span>${savedMark(record, column.key)}<button class="copy-button" type="button" data-action="copy-id" aria-label="IDをコピー" title="IDをコピー">⧉</button></span>`;
            case 'image': return renderImageCell(record);
            case 'hp': return `<span class="number-cell editable-value" data-edit="hp">${escapeHtml(record.battle?.max_hp ?? '')}${savedMark(record, column.key)}</span>`;
            case 'rarity': return `<span class="rarity-tag rarity-${rarityClass(record.rarity)} editable-value" data-edit="rarity">${escapeHtml(record.rarity || '—')}${savedMark(record, column.key)}</span>`;
            case 'drops': return renderDrops(record);
            case 'location': return `<span class="editable-value" data-edit="location">${escapeHtml(record.category || '—')}${savedMark(record, column.key)}</span>`;
            case 'category': return `<span class="editable-value" data-edit="category">${escapeHtml(record.category || '—')}${savedMark(record, column.key)}</span>`;
            case 'description': return `<span class="editable-value" data-edit="description">${escapeHtml(record.description || '—')}${savedMark(record, column.key)}</span>`;
            case 'source': return `<span class="editable-value" data-edit="source">${escapeHtml(sourceValue(record) || '—')}${savedMark(record, column.key)}</span>`;
            case 'enabled': return `<button class="status-toggle" type="button" data-action="toggle-enabled" aria-label="有効状態を切り替え" aria-pressed="${record.is_enabled !== false}" title="${record.is_enabled !== false ? '有効' : '無効'}">${record.is_enabled !== false ? '✓' : '—'}</button>`;
            case 'updatedAt': return `<span class="relative-date">${escapeHtml(relativeDate(record.updatedAt))}</span>`;
            case 'menu': return `<button class="row-menu-button" type="button" data-action="open-detail" aria-label="${escapeAttribute(getName(record))}の詳細を開く" title="詳細を開く">⋯</button>`;
            default: return '';
        }
    }
    function savedMark(record, key) { return state.savedCell?.id === recordId(record) && state.savedCell?.key === key ? '<span class="save-state" aria-label="保存しました">✓</span>' : ''; }
    function renderImageCell(record) {
        const url = safeImageUrl(record.image_url);
        return url ? `<button class="image-thumbnail" type="button" data-action="preview-image" data-url="${escapeAttribute(url)}" aria-label="${escapeAttribute(getName(record))}の画像をプレビュー"><img class="image-thumbnail" src="${escapeAttribute(url)}" alt="" loading="lazy"></button>` : '<span class="image-placeholder" aria-label="画像なし">▧</span>';
    }
    function dropValues(record) { return state.view === 'monsters' ? (record.drops?.length ? record.drops : record.tags || []) : (record.battle_effect?.target_tags || []); }
    function renderDrops(record) {
        const values = dropValues(record);
        if (!values.length) return '<span class="editable-value" data-edit="drops">—</span>';
        const shown = values.slice(0, 2).map((value) => `<span class="drop-tag">${escapeHtml(value)}</span>`).join('');
        const overflow = values.length > 2 ? `<button class="more-drops" type="button" data-action="show-drops" data-drops="${escapeAttribute(values.slice(2).join('\n'))}" aria-label="残り${values.length - 2}件の項目を表示">+${values.length - 2}</button>` : '';
        return `<span class="drop-cell editable-value" data-edit="drops">${shown}${overflow}</span>`;
    }
    function sourceValue(record) { return record.acquisition_method || ''; }
    function rarityClass(value) { return String(value || '').replace(/\s/g, '-'); }
    function fullDate(value) {
        if (!value) return '未記録';
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? '未記録' : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
    }
    function relativeDate(value) {
        if (!value) return '未記録';
        const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
        if (seconds < 60) return 'たった今';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}分前`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}時間前`;
        if (seconds < 2592000) return `${Math.floor(seconds / 86400)}日前`;
        return fullDate(value).slice(0, 10);
    }
    function renderEditControl(record, column) {
        const value = editableValue(record, column.key);
        if (column.key === 'rarity') {
            return `<select class="cell-select" data-inline-input data-key="${column.key}" aria-label="レアリティ">${currentConfig().rarityOptions.map((option) => `<option value="${escapeAttribute(option)}"${value === option ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>`;
        }
        const type = column.key === 'hp' ? 'number' : 'text';
        return `<input class="cell-input" data-inline-input data-key="${column.key}" type="${type}" ${type === 'number' ? 'min="0" inputmode="numeric"' : ''} value="${escapeAttribute(value)}" aria-label="${escapeAttribute(column.label)}を編集">`;
    }
    function editableValue(record, key) {
        const values = { name: getName(record), id: getExternalId(record), hp: record.battle?.max_hp, rarity: record.rarity, drops: dropValues(record).join(', '), location: record.category, category: record.category, description: record.description, source: sourceValue(record) };
        return values[key] ?? '';
    }
    function inlinePayload(key, value) {
        if (state.view === 'monsters') {
            if (key === 'name') return { name_ja: value };
            if (key === 'id') return { monster_id: value };
            if (key === 'hp') return { battle: { max_hp: Number(value) } };
            if (key === 'location') return { category: value };
            if (key === 'drops') return { drops: value.split(',').map((entry) => entry.trim()).filter(Boolean) };
            return { [key]: value };
        }
        if (key === 'name') return { title: value };
        if (key === 'id') return { item_id: value };
        if (key === 'source') return { acquisition_method: value };
        return { [key]: value };
    }
    function beginEdit(record, key) {
        const column = currentConfig().columns.find((item) => item.key === key);
        if (!column?.editable) return;
        state.editing = { id: recordId(record), key, original: editableValue(record, key) };
        renderTable();
        const input = els.body.querySelector('[data-inline-input]');
        if (input) { input.focus(); input.select?.(); }
    }
    async function saveInline(input) {
        const row = input.closest('tr');
        const record = state.records.find((item) => recordId(item) === row?.dataset.recordId);
        const key = input.dataset.key;
        if (!record || !key) return;
        const value = input.value.trim();
        if (key === 'hp' && (!/^\d+$/.test(value) || Number(value) < 1)) { input.setCustomValidity('HPは1以上の整数で入力してください。'); input.reportValidity(); return; }
        if (value === state.editing?.original) { state.editing = null; renderTable(); return; }
        input.disabled = true;
        try {
            const updated = await request(`${currentConfig().endpoint}/${recordId(record)}`, { method: 'PATCH', body: JSON.stringify(inlinePayload(key, value)) });
            replaceRecord(updated);
            state.savedCell = { id: recordId(record), key };
            state.editing = null; renderTable();
            window.setTimeout(() => { state.savedCell = null; renderTable(); }, 1400);
        } catch (error) {
            input.disabled = false; input.setCustomValidity(error.message); input.reportValidity();
        }
    }
    function replaceRecord(updated) { state.records = state.records.map((record) => recordId(record) === recordId(updated) ? updated : record); }
    async function toggleEnabled(record) {
        try { replaceRecord(await request(`${currentConfig().endpoint}/${recordId(record)}`, { method: 'PATCH', body: JSON.stringify({ is_enabled: record.is_enabled === false }) })); renderTable(); }
        catch (error) { state.error = error.message; renderTable(); }
    }
    async function copyId(record, button) {
        try {
            await navigator.clipboard.writeText(getExternalId(record));
            button.textContent = '✓'; button.setAttribute('aria-label', 'コピーしました');
            window.setTimeout(() => { button.textContent = '⧉'; button.setAttribute('aria-label', 'IDをコピー'); }, 1200);
        } catch (_) { state.error = 'クリップボードへコピーできませんでした。'; renderTable(); }
    }
    function openDetail(record) { state.selectedId = recordId(record); state.editing = null; renderTable(); renderDetail(record); els.detail.hidden = false; els.detail.setAttribute('aria-hidden', 'false'); els.detailCloseDesktop.focus(); }
    function closeDetail() { els.detail.hidden = true; els.detail.setAttribute('aria-hidden', 'true'); state.selectedId = null; renderTable(); }
    function field(name, label, value, options = {}) {
        const type = options.type || 'text';
        if (type === 'checkbox') return `<div class="detail-field"><label>${escapeHtml(label)}</label><label class="detail-checkbox"><input type="checkbox" name="${escapeAttribute(name)}"${value !== false ? ' checked' : ''}>有効</label></div>`;
        if (type === 'select') return `<div class="detail-field"><label for="detail-${escapeAttribute(name)}">${escapeHtml(label)}</label><select id="detail-${escapeAttribute(name)}" name="${escapeAttribute(name)}">${options.values.map((option) => `<option value="${escapeAttribute(option)}"${value === option ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select></div>`;
        const tag = type === 'textarea' ? 'textarea' : 'input';
        return `<div class="detail-field"><label for="detail-${escapeAttribute(name)}">${escapeHtml(label)}</label><${tag} id="detail-${escapeAttribute(name)}" name="${escapeAttribute(name)}"${tag === 'input' ? ` type="${type}"${type === 'number' ? ` min="${options.min ?? 0}"` : ''} value="${escapeAttribute(value ?? '')}"` : ''}>${tag === 'textarea' ? escapeHtml(value ?? '') : ''}</${tag}></div>`;
    }
    function detailSection(title, content) { return `<section class="detail-section"><h2>${escapeHtml(title)}</h2>${content}</section>`; }
    function stringArrayItem(name, value = '') {
        return `<div class="array-item"><input type="text" data-array-input="${escapeAttribute(name)}" value="${escapeAttribute(value)}" aria-label="${escapeAttribute(name)}の値"><button type="button" class="icon-button" data-action="remove-array-item" aria-label="項目を削除">×</button></div>`;
    }
    function stringArrayEditor(name, label, values) {
        const items = Array.isArray(values) ? values : [];
        return `<section class="detail-section array-editor" data-array="${escapeAttribute(name)}"><h2>${escapeHtml(label)}</h2><div class="array-items">${items.map((value) => stringArrayItem(name, value)).join('')}</div><button type="button" class="array-add-button" data-action="add-array-item" data-array="${escapeAttribute(name)}">＋ 項目を追加</button></section>`;
    }
    function mechanicEditorItem(mechanic = {}) {
        const pattern = mechanic.pattern || MECHANIC_PATTERNS[0];
        return `<fieldset class="mechanic-item" data-mechanic><legend>メカニクス</legend><button type="button" class="icon-button mechanic-remove" data-action="remove-mechanic" aria-label="このメカニクスを削除">×</button><label>パターン<select data-mechanic-pattern>${MECHANIC_PATTERNS.map((value) => `<option value="${value}"${pattern === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label><label>トリガー<input type="text" data-mechanic-trigger value="${escapeAttribute(mechanic.trigger || 'future_phase')}"></label><label>メッセージ<input type="text" data-mechanic-message value="${escapeAttribute(mechanic.message || '')}"></label><label>ヒント<input type="text" data-mechanic-hint value="${escapeAttribute(mechanic.hint || '')}"></label></fieldset>`;
    }
    function mechanicsEditor(mechanics) {
        const items = Array.isArray(mechanics) ? mechanics : [];
        return `<section class="detail-section mechanics-editor"><h2>メカニクス</h2><div class="mechanic-items">${items.map((mechanic) => mechanicEditorItem(mechanic)).join('')}</div><button type="button" class="array-add-button" data-action="add-mechanic">＋ メカニクスを追加</button></section>`;
    }
    function monsterImageCarousel(record) {
        const defaultUrl = safeImageUrl(record.image_url);
        const damageUrl = safeImageUrl(record.damage_image_url);
        const active = defaultUrl ? 'default' : 'damage';
        const activeUrl = defaultUrl || damageUrl;
        const activeLabel = defaultUrl ? '通常画像' : 'ダメージ差分';
        const hasMultiple = Boolean(defaultUrl && damageUrl);
        return `<section class="detail-section monster-image-carousel" data-image-carousel data-default-url="${escapeAttribute(defaultUrl)}" data-damage-url="${escapeAttribute(damageUrl)}" data-current-image="${active}"><h2>画像</h2><div class="carousel-content"><button type="button" class="icon-button carousel-arrow" data-action="previous-monster-image" aria-label="前の画像を表示"${hasMultiple ? '' : ' disabled'}>←</button><button type="button" class="carousel-image" data-action="preview-carousel-image" aria-label="画像をプレビュー"${activeUrl ? '' : ' disabled'}>${activeUrl ? `<img src="${escapeAttribute(activeUrl)}" alt="${escapeAttribute(getName(record))} ${activeLabel}" loading="lazy">` : '<span aria-hidden="true">▧</span>'}</button><button type="button" class="icon-button carousel-arrow" data-action="next-monster-image" aria-label="次の画像を表示"${hasMultiple ? '' : ' disabled'}>→</button></div><p class="carousel-label" data-carousel-label>${activeUrl ? activeLabel : '画像なし'}</p></section>`;
    }
    function changeMonsterImage(carousel, direction) {
        const images = [
            { key: 'default', label: '通常画像', url: carousel.dataset.defaultUrl },
            { key: 'damage', label: 'ダメージ差分', url: carousel.dataset.damageUrl }
        ].filter((image) => image.url);
        if (images.length < 2) return;
        const current = images.findIndex((image) => image.key === carousel.dataset.currentImage);
        const next = images[(current + direction + images.length) % images.length];
        carousel.dataset.currentImage = next.key;
        const image = carousel.querySelector('img');
        image.src = next.url;
        image.alt = `${getName(state.records.find((record) => recordId(record) === els.detailForm.dataset.recordId) || {})} ${next.label}`;
        carousel.querySelector('[data-carousel-label]').textContent = next.label;
    }
    function renderDetail(record) {
        const monster = state.view === 'monsters';
        const fields = monster ? [
            detailSection('基本情報', field('name', '名前', record.name_ja) + field('id', 'ID', record.monster_id) + field('name_en', '英語名', record.name_en)),
            detailSection('公開・分類', field('enabled', '有効状態', record.is_enabled !== false, { type: 'checkbox' }) + field('is_boss', 'ボス', record.is_boss === true, { type: 'checkbox' }) + field('rarity', 'レアリティ', record.rarity, { type: 'select', values: CONFIG.monsters.rarityOptions }) + field('difficulty', '難易度', record.difficulty, { type: 'number', min: 1 }) + field('category', 'カテゴリ／出現場所', record.category) + field('battle_role', 'バトルロール', record.battle_role)),
            monsterImageCarousel(record),
            detailSection('画像データ', field('image_url', '通常画像URL', record.image_url) + field('has_default_image', '通常画像あり', record.has_default_image === true, { type: 'checkbox' }) + field('damage_image_url', 'ダメージ差分URL', record.damage_image_url) + field('has_damage_diff', 'ダメージ差分あり', record.has_damage_diff === true, { type: 'checkbox' })),
            detailSection('テキスト', field('appearance', '外見', record.appearance, { type: 'textarea' }) + field('behavior', '行動', record.behavior, { type: 'textarea' }) + field('encounter_text', '遭遇時テキスト', record.encounter_text, { type: 'textarea' }) + field('defeat_text', '撃破時テキスト', record.defeat_text, { type: 'textarea' }) + field('inspect_text', '観察時テキスト', record.inspect_text, { type: 'textarea' })),
            detailSection('バトルステータス', field('max_hp', '最大HP', record.battle?.max_hp, { type: 'number', min: 1 }) + field('attack', '攻撃力', record.battle?.attack, { type: 'number', min: 1 }) + field('defense', '防御力', record.battle?.defense, { type: 'number', min: 0 }) + field('reward_beans', '報酬ビーンズ', record.battle?.reward_beans, { type: 'number', min: 0 }) + field('attack_text', '攻撃テキスト', record.battle?.attack_text, { type: 'textarea' })),
            stringArrayEditor('tags', 'タグ', record.tags),
            stringArrayEditor('drops', 'ドロップ', record.drops),
            mechanicsEditor(record.mechanics)
        ] : [
            field('name', '名前', record.title), field('id', 'ID', record.item_id), field('image_url', '画像URL', record.image_url),
            field('category', 'カテゴリ', record.category), field('rarity', 'レアリティ', record.rarity, { type: 'select', values: CONFIG.items.rarityOptions }),
            field('description', '説明', record.description, { type: 'textarea' }), field('source', '入手方法', sourceValue(record)),
            field('enabled', '有効状態', record.is_enabled, { type: 'checkbox' })
        ];
        const imageUrl = safeImageUrl(record.image_url);
        const preview = !monster && imageUrl ? `<button class="detail-image-preview" type="button" data-action="preview-image" data-url="${escapeAttribute(imageUrl)}"><img src="${escapeAttribute(imageUrl)}" alt="${escapeAttribute(getName(record))}" loading="lazy"></button>` : '';
        els.detailForm.dataset.recordId = recordId(record);
        els.detailForm.innerHTML = `${preview}${fields.join('')}<div class="detail-meta">作成日時: ${escapeHtml(fullDate(record.createdAt))}<br>更新日時: ${escapeHtml(fullDate(record.updatedAt))}</div><p class="detail-error" id="detail-error" hidden></p><div class="detail-actions"><button type="button" class="delete-button" data-action="delete-record">削除</button><button class="save-button" type="submit">保存</button></div>`;
    }
    function detailPayload(form) {
        const data = new FormData(form); const get = (key) => String(data.get(key) ?? '').trim();
        const common = { image_url: get('image_url'), rarity: get('rarity'), is_enabled: data.get('enabled') === 'on' };
        if (state.view === 'monsters') {
            const arrayValues = (name) => [...form.querySelectorAll(`[data-array-input="${name}"]`)].map((input) => input.value.trim()).filter(Boolean);
            const mechanics = [...form.querySelectorAll('[data-mechanic]')].map((item) => ({
                pattern: item.querySelector('[data-mechanic-pattern]').value,
                trigger: item.querySelector('[data-mechanic-trigger]').value.trim(),
                message: item.querySelector('[data-mechanic-message]').value.trim(),
                hint: item.querySelector('[data-mechanic-hint]').value.trim()
            }));
            return { ...common, name_ja: get('name'), monster_id: get('id'), name_en: get('name_en'), is_boss: data.get('is_boss') === 'on', difficulty: Number(get('difficulty')), category: get('category'), battle_role: get('battle_role'), image_url: get('image_url'), has_default_image: data.get('has_default_image') === 'on', damage_image_url: get('damage_image_url'), has_damage_diff: data.get('has_damage_diff') === 'on', appearance: get('appearance'), behavior: get('behavior'), encounter_text: get('encounter_text'), defeat_text: get('defeat_text'), inspect_text: get('inspect_text'), tags: arrayValues('tags'), drops: arrayValues('drops'), battle: { max_hp: Number(get('max_hp')), attack: Number(get('attack')), defense: Number(get('defense')), reward_beans: Number(get('reward_beans')), attack_text: get('attack_text') }, mechanics };
        }
        return { ...common, title: get('name'), item_id: get('id'), category: get('category'), description: get('description'), acquisition_method: get('source') };
    }
    async function saveDetail(event) {
        event.preventDefault();
        const record = state.records.find((item) => recordId(item) === els.detailForm.dataset.recordId);
        if (!record) return;
        const errorNode = $('#detail-error'); errorNode.hidden = true;
        const button = els.detailForm.querySelector('.save-button'); button.disabled = true;
        try { const updated = await request(`${currentConfig().endpoint}/${recordId(record)}`, { method: 'PATCH', body: JSON.stringify(detailPayload(els.detailForm)) }); replaceRecord(updated); renderTable(); renderDetail(updated); }
        catch (error) { errorNode.textContent = error.message; errorNode.hidden = false; }
        finally { button.disabled = false; }
    }
    async function createRecord() {
        const stamp = Date.now();
        const payload = state.view === 'monsters' ? { monster_id: `monster_${stamp}`, name_ja: '新しいモンスター' } : { item_id: `item_${stamp}`, title: '新しいアイテム' };
        els.newRecord.disabled = true;
        try { const record = await request(currentConfig().endpoint, { method: 'POST', body: JSON.stringify(payload) }); state.records.unshift(record); state.pagination.total += 1; openDetail(record); }
        catch (error) { state.error = error.message; renderTable(); }
        finally { els.newRecord.disabled = false; }
    }
    function askDelete() { state.deletingId = els.detailForm.dataset.recordId; els.deleteDialog.hidden = false; els.deleteConfirm.focus(); }
    async function deleteRecord() {
        if (!state.deletingId) return;
        els.deleteConfirm.disabled = true;
        try { await request(`${currentConfig().endpoint}/${state.deletingId}`, { method: 'DELETE' }); state.records = state.records.filter((record) => recordId(record) !== state.deletingId); state.pagination.total = Math.max(0, state.pagination.total - 1); els.deleteDialog.hidden = true; state.deletingId = null; closeDetail(); }
        catch (error) { els.deleteDialog.hidden = true; state.error = error.message; renderTable(); }
        finally { els.deleteConfirm.disabled = false; }
    }
    function renderFilterPopover() {
        const config = currentConfig(); const isMonster = state.view === 'monsters';
        const categories = [...new Set(state.records.map((record) => record.category).filter(Boolean))].sort();
        els.filterPopover.innerHTML = `<h2>フィルター</h2><label>レアリティ<select data-filter="rarity"><option value="">すべて</option>${config.rarityOptions.map((value) => `<option value="${escapeAttribute(value)}"${state.filters.rarity === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label><label>有効状態<select data-filter="enabled"><option value="">すべて</option><option value="true"${state.filters.enabled === 'true' ? ' selected' : ''}>有効</option><option value="false"${state.filters.enabled === 'false' ? ' selected' : ''}>無効</option></select></label><label>${isMonster ? '出現場所' : 'カテゴリ'}<select data-filter="category"><option value="">すべて</option>${state.filters.category && !categories.includes(state.filters.category) ? `<option value="${escapeAttribute(state.filters.category)}" selected>${escapeHtml(state.filters.category)}</option>` : ''}${categories.map((value) => `<option value="${escapeAttribute(value)}"${state.filters.category === value ? ' selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select></label>${isMonster ? `<div class="filter-row"><label>HP 最小<input type="number" min="0" data-filter="minHp" value="${escapeAttribute(state.filters.minHp)}"></label><label>HP 最大<input type="number" min="0" data-filter="maxHp" value="${escapeAttribute(state.filters.maxHp)}"></label></div>` : ''}<div class="popover-footer"><button class="text-button" type="button" data-action="clear-filters">クリア</button></div>`;
    }
    function renderSortPopover() {
        const labels = { name: '名前', id: 'ID', hp: state.view === 'monsters' ? 'HP' : '価格', rarity: 'レアリティ', updatedAt: '更新日時' };
        els.sortPopover.innerHTML = `<h2>並べ替え</h2>${Object.entries(labels).map(([key, label]) => `<label><input type="radio" name="sort-key" value="${key}"${state.sort.key === key ? ' checked' : ''}>${label}</label>`).join('')}<div class="popover-footer"><button class="text-button" type="button" data-direction="asc">昇順</button><button class="text-button" type="button" data-direction="desc">降順</button></div>`;
    }
    function renderColumnsPopover() {
        els.columnsPopover.innerHTML = `<h2>表示する列</h2>${currentConfig().columns.filter((column) => column.key !== 'menu').map((column) => `<label><input type="checkbox" data-column="${column.key}"${state.visibleColumns.includes(column.key) ? ' checked' : ''}${column.required ? ' disabled' : ''}>${escapeHtml(column.label)}</label>`).join('')}`;
    }
    function closePopovers() { [els.filterPopover, els.sortPopover, els.columnsPopover, els.dropPopover].forEach((element) => { element.hidden = true; }); }
    function togglePopover(popover, render) { const opening = popover.hidden; closePopovers(); if (opening) { render(); popover.hidden = false; } }
    function changeView(view) {
        if (view === state.view) return;
        state.view = view; state.records = []; state.selectedId = null; state.editing = null; state.visibleColumns = loadColumns(view); state.filters = { rarity: '', enabled: '', category: '', minHp: '', maxHp: '' }; state.sort = { key: 'updatedAt', direction: 'desc' }; closeDetail();
        els.tabs.forEach((tab) => tab.setAttribute('aria-selected', String(tab.dataset.view === view))); updateFilterCount(); updateUrl(); loadRecords();
    }
    function openDrops(button) {
        const rect = button.getBoundingClientRect();
        els.dropPopover.innerHTML = `<h2>残りのドロップ</h2><ul>${button.dataset.drops.split('\n').map((value) => `<li>${escapeHtml(value)}</li>`).join('')}</ul>`;
        els.dropPopover.style.top = `${Math.min(window.innerHeight - 120, rect.bottom + 5)}px`;
        els.dropPopover.style.left = `${Math.min(window.innerWidth - 200, rect.left)}px`;
        els.dropPopover.hidden = false;
    }
    function handleBodyClick(event) {
        const button = event.target.closest('button'); const row = event.target.closest('.data-row');
        if (button?.dataset.action === 'new-record') return createRecord();
        if (!row) return;
        const record = state.records.find((item) => recordId(item) === row.dataset.recordId); if (!record) return;
        const action = button?.dataset.action;
        if (action === 'copy-id') return copyId(record, button);
        if (action === 'toggle-enabled') return toggleEnabled(record);
        if (action === 'open-detail') return openDetail(record);
        if (action === 'preview-image') { els.previewImage.src = button.dataset.url; els.previewImage.alt = `${getName(record)}の画像`; els.imagePreview.hidden = false; return; }
        if (action === 'show-drops') { event.stopPropagation(); closePopovers(); openDrops(button); return; }
        if (!button && !event.target.closest('input,select,textarea')) openDetail(record);
    }
    function bindEvents() {
        els.tabs.forEach((tab) => tab.addEventListener('click', () => changeView(tab.dataset.view)));
        els.searchToggle.addEventListener('click', () => { els.searchControl.classList.add('is-open'); els.search.focus(); });
        els.searchClose.addEventListener('click', () => { els.search.value = ''; state.search = ''; els.searchControl.classList.remove('is-open'); updateUrl(); loadRecords(); });
        els.search.value = state.search;
        els.search.addEventListener('input', () => { window.clearTimeout(searchTimer); searchTimer = window.setTimeout(() => { state.search = els.search.value.trim(); updateUrl(); loadRecords(); }, 320); });
        if (state.search) els.searchControl.classList.add('is-open');
        els.filterToggle.addEventListener('click', () => togglePopover(els.filterPopover, renderFilterPopover));
        els.sortToggle.addEventListener('click', () => togglePopover(els.sortPopover, renderSortPopover));
        els.columnsToggle.addEventListener('click', () => togglePopover(els.columnsPopover, renderColumnsPopover));
        els.reload.addEventListener('click', loadRecords); els.retry.addEventListener('click', loadRecords); els.newRecord.addEventListener('click', createRecord);
        els.head.addEventListener('click', (event) => { const sort = event.target.closest('[data-sort]')?.dataset.sort; if (sort) { state.sort = { key: sort, direction: state.sort.key === sort && state.sort.direction === 'asc' ? 'desc' : 'asc' }; updateUrl(); loadRecords(); } });
        els.body.addEventListener('click', handleBodyClick);
        els.body.addEventListener('dblclick', (event) => { const target = event.target.closest('[data-edit]'); const row = event.target.closest('.data-row'); if (target && row) { const record = state.records.find((item) => recordId(item) === row.dataset.recordId); beginEdit(record, target.dataset.edit); } });
        els.body.addEventListener('keydown', (event) => {
            const input = event.target.closest('[data-inline-input]');
            if (input) { if (event.key === 'Enter') { event.preventDefault(); saveInline(input); } if (event.key === 'Escape') { state.editing = null; renderTable(); } return; }
            const row = event.target.closest('.data-row');
            if (event.key === 'Enter' && row) { event.preventDefault(); const record = state.records.find((item) => recordId(item) === row.dataset.recordId); openDetail(record); }
            if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && row) { event.preventDefault(); const rows = [...els.body.querySelectorAll('.data-row')]; const index = rows.indexOf(row); rows[index + (event.key === 'ArrowDown' ? 1 : -1)]?.focus(); }
        });
        els.body.addEventListener('focusout', (event) => { const input = event.target.closest('[data-inline-input]'); if (input && state.editing) window.setTimeout(() => { if (state.editing && !document.activeElement?.matches('[data-inline-input]')) saveInline(input); }, 0); });
        document.addEventListener('click', (event) => { if (!event.target.closest('.popover-anchor, #drop-popover')) closePopovers(); });
        [els.filterPopover, els.sortPopover, els.columnsPopover].forEach((popover) => popover.addEventListener('change', (event) => {
            const target = event.target;
            if (target.dataset.filter) { state.filters[target.dataset.filter] = target.value; updateFilterCount(); updateUrl(); loadRecords(); }
            if (target.name === 'sort-key') { state.sort.key = target.value; updateUrl(); loadRecords(); }
            if (target.dataset.column) { const key = target.dataset.column; state.visibleColumns = target.checked ? [...state.visibleColumns, key] : state.visibleColumns.filter((item) => item !== key); state.visibleColumns = currentConfig().columns.map((column) => column.key).filter((key) => state.visibleColumns.includes(key)); saveColumns(); renderTable(); }
        }));
        [els.filterPopover, els.sortPopover, els.columnsPopover].forEach((popover) => popover.addEventListener('click', (event) => {
            const target = event.target.closest('button'); if (!target) return;
            if (target.dataset.action === 'clear-filters') { state.filters = { rarity: '', enabled: '', category: '', minHp: '', maxHp: '' }; updateFilterCount(); updateUrl(); renderFilterPopover(); loadRecords(); }
            if (target.dataset.direction) { state.sort.direction = target.dataset.direction; updateUrl(); closePopovers(); loadRecords(); }
        }));
        els.detailClose.addEventListener('click', closeDetail); els.detailCloseDesktop.addEventListener('click', closeDetail); els.detailForm.addEventListener('submit', saveDetail);
        els.detailForm.addEventListener('click', (event) => {
            const action = event.target.closest('[data-action]');
            if (!action) return;
            if (action.dataset.action === 'delete-record') { askDelete(); return; }
            if (action.dataset.action === 'add-array-item') {
                const items = els.detailForm.querySelector(`.array-editor[data-array="${action.dataset.array}"] .array-items`);
                items?.insertAdjacentHTML('beforeend', stringArrayItem(action.dataset.array));
                items?.querySelector(':scope > .array-item:last-child input')?.focus();
                return;
            }
            if (action.dataset.action === 'remove-array-item') { action.closest('.array-item')?.remove(); return; }
            if (action.dataset.action === 'add-mechanic') {
                const items = els.detailForm.querySelector('.mechanic-items');
                items?.insertAdjacentHTML('beforeend', mechanicEditorItem());
                items?.querySelector(':scope > .mechanic-item:last-child [data-mechanic-pattern]')?.focus();
                return;
            }
            if (action.dataset.action === 'remove-mechanic') { action.closest('[data-mechanic]')?.remove(); return; }
            if (action.dataset.action === 'previous-monster-image' || action.dataset.action === 'next-monster-image') {
                changeMonsterImage(action.closest('[data-image-carousel]'), action.dataset.action === 'next-monster-image' ? 1 : -1);
                return;
            }
            if (action.dataset.action === 'preview-carousel-image') {
                const image = action.querySelector('img');
                if (image?.src) { els.previewImage.src = image.src; els.previewImage.alt = image.alt; els.imagePreview.hidden = false; }
                return;
            }
            if (action.dataset.action === 'preview-image') { els.previewImage.src = action.dataset.url; els.previewImage.alt = '画像プレビュー'; els.imagePreview.hidden = false; }
        });
        els.deleteCancel.addEventListener('click', () => { els.deleteDialog.hidden = true; state.deletingId = null; }); els.deleteConfirm.addEventListener('click', deleteRecord);
        els.imagePreview.addEventListener('click', (event) => { if (event.target === els.imagePreview || event.target.closest('.preview-close')) els.imagePreview.hidden = true; });
        document.addEventListener('keydown', (event) => { if (event.key !== 'Escape') return; if (!els.imagePreview.hidden) { els.imagePreview.hidden = true; return; } if (!els.deleteDialog.hidden) { els.deleteDialog.hidden = true; state.deletingId = null; return; } if (state.editing) { state.editing = null; renderTable(); return; } closePopovers(); if (!els.detail.hidden) closeDetail(); });
    }
    bindEvents(); updateFilterCount(); updateUrl(); loadRecords();
})();
