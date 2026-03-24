/**
 * 运动户外专用版 app.js (语法纠偏终极版)
 */

const state = { 
  allProducts: [], 
  filteredProducts: [],
  selectedIds: new Set() 
};

const els = {
  keyword: document.getElementById('keyword'),
  category1: document.getElementById('category1'),
  category2: document.getElementById('category2'),
  priority: document.getElementById('priority'),
  minPrice: document.getElementById('minPrice'),
  maxPrice: document.getElementById('maxPrice'),
  sortBy: document.getElementById('sortBy'),
  resetBtn: document.getElementById('resetBtn'),
  exportBtn: document.getElementById('exportBtn'),
  filteredCount: document.getElementById('filteredCount'),
  cardGrid: document.getElementById('cardGrid'),
  emptyState: document.getElementById('emptyState'),
  toast: document.getElementById('toast')
};

async function init() {
  try {
    const response = await fetch('./data.csv?v=' + Date.now());
    if (!response.ok) throw new Error('找不到 data.csv 文件');
    const csvText = await response.text();
    const products = parseCSV(csvText);
    state.allProducts = products;
    fillCategory1Options();
    bindEvents();
    applyFilters();
  } catch (error) {
    console.error("加载失败:", error);
  }
}

function parseCSV(text) {
  if (window.Papa) {
    const result = Papa.parse(text, { header: true, skipEmptyLines: 'greedy', quoteChar: '"', escapeChar: '"' });
    return result.data.filter(item => item.title && item.price);
  }
  return [];
}

function bindEvents() {
  [els.keyword, els.minPrice, els.maxPrice].forEach(el => {
    if(el) ['input','change'].forEach(evt => el.addEventListener(evt, applyFilters));
  });
  [els.category1, els.category2, els.priority, els.sortBy].forEach(el => {
    if(el) el.addEventListener('change', () => {
      if (el === els.category1) refillCategory2Options();
      applyFilters();
    });
  });
  els.resetBtn?.addEventListener('click', () => {
    els.keyword.value = ''; els.category1.value = ''; els.category2.value = '';
    els.priority.value = ''; els.minPrice.value = ''; els.maxPrice.value = '';
    els.sortBy.value = 'default';
    state.selectedIds.clear(); 
    refillCategory2Options();
    applyFilters();
  });
  els.exportBtn?.addEventListener('click', () => {
    let data = state.selectedIds.size > 0 
      ? state.allProducts.filter(item => state.selectedIds.has(String(item.modelId || item.itemid)))
      : state.filteredProducts;
    if (!data.length) return showToast("没有可导出的数据");
    const csv = Papa.unparse(data);
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `export_${Date.now()}.csv`;
    link.click();
    showToast(`成功导出 ${data.length} 条`);
  });
}

function fillCategory1Options() {
  const values = [...new Set(state.allProducts.map(x => x.l1).filter(Boolean))];
  if(els.category1) {
    els.category1.innerHTML = '<option value="">二级类目(全部)</option>';
    values.sort().forEach(v => {
      const op = document.createElement('option'); op.value = v; op.textContent = v;
      els.category1.appendChild(op);
    });
  }
  refillCategory2Options();
}

function refillCategory2Options() {
  if(!els.category2) return;
  els.category2.innerHTML = '<option value="">三级类目(全部)</option>';
  const selected = els.category1.value;
  let source = selected ? state.allProducts.filter(x => x.l1 === selected) : state.allProducts;
  const values = [...new Set(source.map(x => x.l2).filter(Boolean))];
  values.sort().forEach(v => {
    const op = document.createElement('option'); op.value = v; op.textContent = v;
    els.category2.appendChild(op);
  });
}

function applyFilters() {
  const keyword = (els.keyword.value || '').trim().toLowerCase();
  const cat1 = els.category1.value;
  const cat2 = els.category2.value;
  const prio = els.priority.value;
  const minP = parseFloat(els.minPrice.value);
  const maxP = parseFloat(els.maxPrice.value);
  const sort = els.sortBy.value;

  let list = state.allProducts.filter(item => {
    const text = [item.title, item.inviteId, item.modelId, item.itemid].join(' ').toLowerCase();
    return (!keyword || text.includes(keyword)) &&
           (!cat1 || String(item.l1) === cat1) &&
           (!cat2 || String(item.l2) === cat2) &&
           (!prio || (item['提品优先级'] || '').includes(prio)) &&
           (Number.isNaN(minP) || parseFloat(item.price) >= minP) &&
           (Number.isNaN(maxP) || parseFloat(item.price) <= maxP);
  });

  if (sort === 'priceAsc') list.sort((a,b) => parseFloat(a.price) - parseFloat(b.price));
  else if (sort === 'priceDesc') list.sort((a,b) => parseFloat(b.price) - parseFloat(a.price));
  else if (sort === 'dateDesc') list.sort((a,b) => String(b['update date']).localeCompare(String(a['update date'])));

  state.filteredProducts = list;
  renderCards();
}

/**
 * 核心修正：严格控制输出格式，拒绝重复
 */
function updateCountDisplay() {
  if (!els.filteredCount) return;
  const checkedCount = state.selectedIds.size;
  const filteredCount = state.filteredProducts.length;
  
  // 构造干净的字符串
  let resultText = `已筛选：${filteredCount}款`;
  if (checkedCount > 0) {
    resultText += `——<span style="color: #0b57d7; font-weight: bold;">已勾选：${checkedCount}款</span>`;
  }
  
  // 最终格式加括号
  els.filteredCount.innerHTML = `(${resultText})`;
}

function renderCards() {
  updateCountDisplay(); // 唯一的文字入口

  if (!state.filteredProducts.length) {
    els.cardGrid.innerHTML = '';
    els.emptyState?.classList.remove('hidden');
    return;
  }
  els.emptyState?.classList.add('hidden');

  els.cardGrid.innerHTML = state.filteredProducts.map(item => {
    const itemId = String(item.modelId || item.itemid);
    const isChecked = state.selectedIds.has(itemId) ? 'checked' : '';
    const pVal = item['提品优先级'] || '-';
    const pClass = pVal.includes('高') ? 'p0' : 'p1';

    return `
      <article class="card">
        <div class="card-checkbox">
          <input type="checkbox" class="select-item" data-id="${escapeHtml(itemId)}" ${isChecked}>
        </div>
        <div class="card-top">
          <span class="priority-badge ${pClass}">${escapeHtml(pVal)}</span>
          <div class="card-image-wrap">
            <img class="card-image" src="${escapeHtml(item.imgUrl)}" onerror="this.src='https://images.placeholders.dev/?width=200&height=200&text=无图片';">
          </div>
        </div>
        <div class="card-bottom">
          <div class="title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
          <div class="price-row">
            <div class="price">¥${parseFloat(item.price || 0).toFixed(2)}</div>
            <div class="spec-name">${escapeHtml(item.variant || '')}</div>
          </div>
          <div class="invitation-row" style="margin: 8px 0;">
             <div class="invitation-box" data-copy="${escapeHtml(item.inviteId || '')}">${escapeHtml(item.inviteId || '')}</div>
          </div>
          <div class="links-row">
            ${item.link ? `<a class="link-btn link-origin" href="${escapeHtml(item.link)}" target="_blank">原品</a>` : ''}
            ${item.final_1688_link ? `<a class="link-btn link-1688" href="${escapeHtml(item.final_1688_link)}" target="_blank">1688</a>` : ''}
          </div>
          <div class="footer-row">
            <div class="mini-id">ID: ${escapeHtml(item.modelId || '')}</div>
            <div class="update-date">${escapeHtml(item['update date'] || '')}</div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // 绑定事件
  document.querySelectorAll('.select-item').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = e.target.getAttribute('data-id');
      e.target.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
      updateCountDisplay();
    });
  });
  document.querySelectorAll('.invitation-box').forEach(el => {
    el.onclick = async () => {
      const val = el.getAttribute('data-copy');
      if (val) {
        try { await navigator.clipboard.writeText(val); showToast(`已复制：${val}`); }
        catch(e) { showToast('复制失败'); }
      }
    };
  });
}

function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function showToast(msg) {
  if(!els.toast) return;
  els.toast.textContent = msg; els.toast.classList.remove('hidden');
  clearTimeout(timer); timer = setTimeout(() => els.toast.classList.add('hidden'), 1800);
}
let timer = null;
init();
