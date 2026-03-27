/**
 * 运动户外版 - 最终修复版
 * 重点：对接 variant 列，统一 data.csv 路径
 */
const state = { 
  allProducts: [], filteredProducts: [], selectedIds: new Set() 
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
    // 确保这里的路径与 GitHub 仓库根目录的文件名完全一致
    const response = await fetch('./data.csv?v=' + Date.now()); 
    if (!response.ok) throw new Error("无法读取 data.csv，请确认文件名大小写是否一致");
    
    const csvText = await response.text();
    const result = Papa.parse(csvText, { header: true, skipEmptyLines: 'greedy' });
    state.allProducts = result.data.filter(item => item.title || item.inviteId);
    
    fillCategory1Options();
    bindEvents();
    applyFilters();
  } catch (e) {
    console.error(e);
    if(els.cardGrid) els.cardGrid.innerHTML = `<div class="empty">加载失败: ${e.message}</div>`;
  }
}

function updateCountDisplay() {
  if (!els.filteredCount) return;
  const checked = state.selectedIds.size;
  const filtered = state.filteredProducts.length;
  let html = `已筛选：${filtered}款`;
  if (checked > 0) {
    html += ` —— <span style="color: #0b57d7; font-weight: 900;">已勾选：${checked}款</span>`;
  }
  els.filteredCount.innerHTML = `${html}`;
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
    const id = String(item.modelId || item.itemid || '');
    const isChecked = state.selectedIds.has(id) ? 'checked' : '';
    const pVal = item['提品优先级'] || '-';
    const pClass = pVal.includes('高') ? 'p0' : 'p1';

    // 【核心修复】读取 CSV 中对应的 variant 列
    const spec = item['variant'] || '标准规格';

    return `
      <article class="card">
        <div class="card-checkbox">
          <input type="checkbox" class="select-item" data-id="${id}" ${isChecked}>
        </div>
        <div class="card-top">
          <span class="priority-badge ${pClass}">${pVal}</span>
          <div class="card-image-wrap">
            <img class="card-image" src="${item.imgUrl}" onerror="this.src='https://via.placeholder.com/258?text=无图片';">
          </div>
        </div>
        <div class="card-bottom">
          <div class="title" title="${item.title}">${item.title}</div>
          
          <div style="display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; gap: 8px;">
            <div class="price">¥${parseFloat(item.price || 0).toFixed(2)}</div>
            
            <div style="font-size: 12px; color: #888; font-weight: 400; max-width: 60%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${spec}">
              ${spec}
            </div>
          </div>

          <div class="invitation-row">
            <div class="invitation-box" onclick="copyVal('${item.inviteId}')">${item.inviteId || '无'}</div>
          </div>
          <div class="links-row">
            <a class="link-btn link-origin" style="padding: 8px 4px; font-size: 12px;" href="${item.link}" target="_blank">原品链接</a>
            <a class="link-btn link-1688" style="padding: 8px 4px; font-size: 12px;" href="${item.final_1688_link}" target="_blank">1688链接</a>
          </div>
          <div class="footer-row">
            <div>ID: ${item.modelId || '-'}</div>
            <div>${item['update date'] || ''}</div>
          </div>
        </div>
      </article>`;
  }).join('');

  document.querySelectorAll('.select-item').forEach(cb => {
    cb.onchange = (e) => {
      const id = e.target.dataset.id;
      e.target.checked ? state.selectedIds.add(id) : state.selectedIds.delete(id);
      updateCountDisplay();
    };
  });
}

function bindEvents() {
  [els.keyword, els.minPrice, els.maxPrice].forEach(el => el?.addEventListener('input', applyFilters));
  [els.category1, els.category2, els.priority, els.sortBy].forEach(el => el?.addEventListener('change', () => {
    if (el === els.category1) refillCategory2Options();
    applyFilters();
  }));
  els.resetBtn?.addEventListener('click', () => location.reload());
  els.exportBtn?.addEventListener('click', () => {
    let data = state.selectedIds.size > 0 ? state.allProducts.filter(item => state.selectedIds.has(String(item.modelId || item.itemid))) : state.filteredProducts;
    const csv = Papa.unparse(data);
    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `选品清单.csv`;
    link.click();
  });
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
    const text = [item.title, item.inviteId, item.modelId].join(' ').toLowerCase();
    const price = parseFloat(item.price || 0);
    return (!kw || text.includes(kw)) && (!c1 || item.l1 === c1) && (!c2 || item.l2 === c2) && (!pr || (item['提品优先级'] || '').includes(pr)) && (isNaN(min) || price >= min) && (isNaN(max) || price <= max);
  });

  if (sort === 'priceAsc') state.filteredProducts.sort((a,b) => parseFloat(a.price)-parseFloat(b.price));
  else if (sort === 'priceDesc') state.filteredProducts.sort((a,b) => parseFloat(b.price)-parseFloat(a.price));
  
  renderCards();
}

function fillCategory1Options() {
  const values = [...new Set(state.allProducts.map(x => x.l1).filter(Boolean))].sort();
  if(els.category1) els.category1.innerHTML = '<option value="">二级类目(全部)</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('');
  refillCategory2Options();
}

function refillCategory2Options() {
  const selected = els.category1?.value;
  const source = selected ? state.allProducts.filter(x => x.l1 === selected) : state.allProducts;
  const values = [...new Set(source.map(x => x.l2).filter(Boolean))].sort();
  if(els.category2) els.category2.innerHTML = '<option value="">三级类目(全部)</option>' + values.map(v => `<option value="${v}">${v}</option>`).join('');
}

window.copyVal = (v) => {
  navigator.clipboard.writeText(v).then(() => {
    if(els.toast) {
      els.toast.textContent = "已复制: " + v;
      els.toast.classList.remove('hidden');
      setTimeout(() => els.toast.classList.add('hidden'), 2000);
    }
  });
};

init();
