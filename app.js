/**
 * 运动户外专用版 app.js (修正版)
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
  filteredCount: document.getElementById('filteredCount'), // 现在指向外层 div
  cardGrid: document.getElementById('cardGrid'),
  emptyState: document.getElementById('emptyState'),
  toast: document.getElementById('toast')
};

// ... (init, parseCSV, bindEvents, fillCategory, refillCategory, applyFilters 保持不变) ...
// 为了节省篇幅，这里略过中间重复的逻辑函数，请确保你保留之前的 bindEvents 等内容

async function init() {
  try {
    const response = await fetch('./data.csv?v=' + Date.now());
    const csvText = await response.text();
    state.allProducts = parseCSV(csvText);
    fillCategory1Options();
    bindEvents();
    applyFilters();
  } catch (e) { console.error(e); }
}

function parseCSV(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: 'greedy' }).data.filter(item => item.title && item.price);
}

function bindEvents() {
  [els.keyword, els.minPrice, els.maxPrice].forEach(el => el?.addEventListener('input', applyFilters));
  [els.category1, els.category2, els.priority, els.sortBy].forEach(el => el?.addEventListener('change', () => {
    if (el === els.category1) refillCategory2Options();
    applyFilters();
  }));
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
    if (!data.length) return showToast("没有数据可导出");
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
  const values = [...new Set(state.allProducts.map(x => x.l1).filter(Boolean))].sort();
  els.category1.innerHTML = '<option value="">二级类目(全部)</option>' + 
    values.map(v => `<option value="${v}">${v}</option>`).join('');
  refillCategory2Options();
}

function refillCategory2Options() {
  const selected = els.category1.value;
  const source = selected ? state.allProducts.filter(x => x.l1 === selected) : state.allProducts;
  const values = [...new Set(source.map(x => x.l2).filter(Boolean))].sort();
  els.category2.innerHTML = '<option value="">三级类目(全部)</option>' + 
    values.map(v => `<option value="${v}">${v}</option>`).join('');
}

function applyFilters() {
  const kw = els.keyword.value.trim().toLowerCase();
  const c1 = els.category1.value;
  const c2 = els.category2.value;
  const pr = els.priority.value;
  const min = parseFloat(els.minPrice.value);
  const max = parseFloat(els.maxPrice.value);
  const sort = els.sortBy.value;

  state.filteredProducts = state.allProducts.filter(item => {
    const text = [item.title, item.inviteId, item.modelId, item.itemid].join(' ').toLowerCase();
    return (!kw || text.includes(kw)) &&
           (!c1 || String(item.l1) === c1) &&
           (!c2 || String(item.l2) === c2) &&
           (!pr || (item['提品优先级'] || '').includes(pr)) &&
           (isNaN(min) || parseFloat(item.price) >= min) &&
           (isNaN(max) || parseFloat(item.price) <= max)
  });

  if (sort === 'priceAsc') state.filteredProducts.sort((a,b) => parseFloat(a.price) - parseFloat(b.price));
  else if (sort === 'priceDesc') state.filteredProducts.sort((a,b) => parseFloat(b.price) - parseFloat(a.price));
  else if (sort === 'dateDesc') state.filteredProducts.sort((a,b) => String(b['update date']).localeCompare(String(a['update date'])));

  renderCards();
}

/**
 * 重点：干净的文字输出
 */
function updateCountDisplay() {
  if (!els.filteredCount) return;
  const checkedCount = state.selectedIds.size;
  const filteredCount = state.filteredProducts.length;
  
  let html = `已筛选：${filteredCount}款`;
  if (checkedCount > 0) {
    html += `——<span style="color: #0b57d7; font-weight: bold;">已勾选：${checkedCount}款</span>`;
  }
  
  els.filteredCount.innerHTML = `(${html})`;
}

function renderCards() {
  updateCountDisplay();
  if (!state.filteredProducts.length) {
    els.cardGrid.innerHTML = '';
    els.emptyState?.classList.remove('hidden');
    return;
  }
  els.emptyState?.classList.add('hidden');
  els.cardGrid.innerHTML = state.filteredProducts.map(item => {
    const id = String(item.modelId || item.itemid);
    const checked = state.selectedIds.has(id) ? 'checked' : '';
    const pVal = item['提品优先级'] || '-';
    return `
      <article class="card">
        <div class="card-checkbox"><input type="checkbox" class="select-item" data-id="${id}" ${checked}></div>
        <div class="card-top">
          <span class="priority-badge ${pVal.includes('高')?'p0':'p1'}">${pVal}</span>
          <div class="card-image-wrap"><img class="card-image" src="${item.imgUrl}" onerror="this.src='https://images.placeholders.dev/?width=200&height=200&text=无图片';"></div>
        </div>
        <div class="card-bottom">
          <div class="title" title="${item.title}">${item.title}</div>
          <div class="price-row">
            <div class="price">¥${parseFloat(item.price||0).toFixed(2)}</div>
            <div class="spec-name">${item.variant || ''}</div>
          </div>
          <div class="invitation-row"><div class="invitation-box" data-copy="${item.inviteId||''}">${item.inviteId||''}</div></div>
          <div class="links-row">
            ${item.link ? `<a class="link-btn link-origin" href="${item.link}" target="_blank">原品</a>` : ''}
            ${item.final_1688_link ? `<a class="link-btn link-1688" href="${item.final_1688_link}" target="_blank">1688</a>` : ''}
          </div>
          <div class="footer-row">
            <div class="mini-id">ID: ${item.modelId || ''}</div>
            <div class="update-date">${item['update date'] || ''}</div>
          </div>
        </div>
      </article>
    `;
  }).join('');

  document.querySelectorAll('.select-item').forEach(cb => {
    cb.onclick = (e) => {
      const id = e.target.dataset.id;
      e.target.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
      updateCountDisplay();
    };
  });
  document.querySelectorAll('.invitation-box').forEach(el => {
    el.onclick = async () => {
      try { await navigator.clipboard.writeText(el.dataset.copy); showToast("已复制：" + el.dataset.copy); } catch(e) {}
    };
  });
}

function showToast(msg) {
  els.toast.textContent = msg; els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 1800);
}
init();
