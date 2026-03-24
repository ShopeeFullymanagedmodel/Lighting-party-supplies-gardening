/**
 * 运动户外专用版 app.js - 增强诊断版
 */

const state = { 
  allProducts: [], 
  filteredProducts: [],
  selectedIds: new Set() 
};

const els = {};

function initElements() {
  const ids = [
    'keyword', 'category1', 'category2', 'priority', 
    'minPrice', 'maxPrice', 'sortBy', 'resetBtn', 
    'exportBtn', 'filteredCount', 'cardGrid', 'emptyState', 'toast'
  ];
  ids.forEach(id => {
    els[id] = document.getElementById(id);
  });
}

async function init() {
  initElements();
  try {
    // 【关键检查点】确保文件名是 data.csv 且在根目录
    const fileName = './data.csv'; 
    const response = await fetch(fileName + '?v=' + Date.now());
    
    if (!response.ok) {
        throw new Error(`找不到文件：${fileName} (状态码: ${response.status})。请检查文件名是否全小写且在根目录。`);
    }

    const csvText = await response.text();
    
    if (window.Papa) {
      const result = Papa.parse(csvText, { 
        header: true, 
        skipEmptyLines: 'greedy',
        complete: function(results) {
            state.allProducts = results.data.filter(item => item.title && item.price);
            if(state.allProducts.length === 0) {
                if(els.cardGrid) els.cardGrid.innerHTML = '<div style="padding:20px;text-align:center;color:orange;">数据读取成功，但内容为空，请检查CSV表头是否包含 title 和 price</div>';
            }
            fillCategory1Options();
            bindEvents();
            applyFilters();
        }
      });
    } else {
      throw new Error("解析库 PapaParse 加载失败，请检查联网状态");
    }
  } catch (error) {
    console.error("初始化失败:", error);
    if(els.cardGrid) {
        els.cardGrid.innerHTML = `<div style="padding:40px;text-align:center;color:red;font-weight:bold;">
            ❌ 加载失败<br><br>
            原因：${error.message}<br><br>
            <small>请确保 GitHub 仓库中有一个名为 data.csv 的文件</small>
        </div>`;
    }
  }
}

// --- 以下功能函数保持不变 ---

function bindEvents() {
  [els.keyword, els.minPrice, els.maxPrice].forEach(el => el?.addEventListener('input', applyFilters));
  [els.category1, els.category2, els.priority, els.sortBy].forEach(el => el?.addEventListener('change', () => {
    if (el === els.category1) refillCategory2Options();
    applyFilters();
  }));
  els.resetBtn?.addEventListener('click', () => {
    if(els.keyword) els.keyword.value = '';
    if(els.category1) els.category1.value = '';
    if(els.category2) els.category2.value = '';
    if(els.priority) els.priority.value = '';
    if(els.minPrice) els.minPrice.value = '';
    if(els.maxPrice) els.maxPrice.value = '';
    if(els.sortBy) els.sortBy.value = 'default';
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
    showToast(`导出成功`);
  });
}

function fillCategory1Options() {
  if (!els.category1) return;
  const values = [...new Set(state.allProducts.map(x => x.l1).filter(Boolean))].sort();
  els.category1.innerHTML = '<option value="">二级类目(全部)</option>' + 
    values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
  refillCategory2Options();
}

function refillCategory2Options() {
  if (!els.category2) return;
  const selected = els.category1 ? els.category1.value : '';
  const source = selected ? state.allProducts.filter(x => x.l1 === selected) : state.allProducts;
  const values = [...new Set(source.map(x => x.l2).filter(Boolean))].sort();
  els.category2.innerHTML = '<option value="">三级类目(全部)</option>' + 
    values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
}

function applyFilters() {
  const kw = els.keyword?.value.trim().toLowerCase() || '';
  const c1 = els.category1?.value || '';
  const c2 = els.category2?.value || '';
  const pr = els.priority?.value || '';
  const min = parseFloat(els.minPrice?.value);
  const max = parseFloat(els.maxPrice?.value);
  const sort = els.sortBy?.value || 'default';

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
  if (!els.cardGrid) return;
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
        <div class="card-checkbox"><input type="checkbox" class="select-item" data-id="${escapeHtml(id)}" ${checked}></div>
        <div class="card-top">
          <span class="priority-badge ${pVal.includes('高')?'p0':'p1'}">${escapeHtml(pVal)}</span>
          <div class="card-image-wrap"><img class="card-image" src="${escapeHtml(item.imgUrl)}" onerror="this.src='https://images.placeholders.dev/?width=200&height=200&text=无图片';"></div>
        </div>
        <div class="card-bottom">
          <div class="title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
          <div class="price-row">
            <div class="price">¥${parseFloat(item.price || 0).toFixed(2)}</div>
            <div class="spec-name">${escapeHtml(item.variant || '')}</div>
          </div>
          <div class="invitation-row"><div class="invitation-box" data-copy="${escapeHtml(item.inviteId||'')}">${escapeHtml(item.inviteId||'')}</div></div>
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

  document.querySelectorAll('.select-item').forEach(cb => {
    cb.onclick = (e) => {
      const id = e.target.getAttribute('data-id');
      e.target.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
      updateCountDisplay();
    };
  });
  document.querySelectorAll('.invitation-box').forEach(el => {
    el.onclick = async () => {
      const val = el.getAttribute('data-copy');
      try { await navigator.clipboard.writeText(val); showToast("已复制：" + val); } catch (e) {}
    };
  });
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
}

function showToast(msg) {
  if (!els.toast) return;
  els.toast.textContent = msg; els.toast.classList.remove('hidden');
  setTimeout(() => els.toast.classList.add('hidden'), 2000);
}

window.addEventListener('DOMContentLoaded', init);
