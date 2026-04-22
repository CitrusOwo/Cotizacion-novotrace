function customConfirm({ icon = '❓', title = '¿Estás seguro?', msg = '', okClass = 'danger', okText = 'Confirmar' } = {}) {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirm_modal');
    document.getElementById('confirm_icon').textContent = icon;
    document.getElementById('confirm_title').textContent = title;
    document.getElementById('confirm_msg').textContent = msg;
    const okBtn = document.getElementById('confirm_ok');
    okBtn.textContent = okText;
    okBtn.className = `btn ${okClass}`;
    overlay.classList.remove('hidden');
    const cleanup = (result) => {
      overlay.classList.add('hidden');
      const cancelBtn = document.getElementById('confirm_cancel');
      okBtn.replaceWith(okBtn.cloneNode(true));
      cancelBtn.replaceWith(cancelBtn.cloneNode(true));
      resolve(result);
    };
    document.getElementById('confirm_ok').addEventListener('click', () => cleanup(true), { once: true });
    document.getElementById('confirm_cancel').addEventListener('click', () => cleanup(false), { once: true });
  });
}

let items = [];
const LOGO_PATH = '/imagenes/Recurso 43.png';
let saveTimeout;
let lastSavedQuote = '';

const currencySymbols = { 'USD': '$', 'PEN': 'S/', 'EUR': '€' };

const DEFAULT_TERMS = `Tiempo de entrega: inmediato sujeto a stock.
Estaremos a disposición para cualquier aclaración que sea necesaria.`;

async function fetchNextQuoteNumber() {
  try {
    const res = await fetch('/next-quote-number');
    const data = await res.json();
    if (data.quote_number) {
      document.getElementById('quote_number').value = data.quote_number;
    }
  } catch (err) {
    console.error('Error al obtener número de cotización:', err);
  }
}

function formatMoney(v, curr = 'USD') {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: curr }).format(v);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getCurrency() {
  return document.getElementById('currency').value;
}

function renderItemsTable() {
  const itemsBody = document.getElementById('items_body');
  itemsBody.innerHTML = '';
  items.forEach((it) => {
    const tr = document.createElement('tr');
    tr.className = 'fade-in';
    tr.innerHTML = `
      <td><input data-id="${it.id}" data-field="desc" value="${escapeHtml(it.desc ?? '')}" placeholder="Descripción" style="width:100%;border:0;background:transparent;font-size:13px"/></td>
      <td><input data-id="${it.id}" data-field="qty" type="number" min="1" value="${it.qty ?? 1}" style="width:100%;border:0;background:transparent;font-size:13px;text-align:center"/></td>
      <td><input data-id="${it.id}" data-field="price" type="number" min="0" step="0.01" value="${it.price ?? 0}" style="width:100%;border:0;background:transparent;font-size:13px;text-align:right"/></td>
      <td class="total-cell" style="text-align:right;font-size:13px;font-weight:600">${formatMoney((it.qty ?? 0) * (it.price ?? 0), getCurrency())}</td>
      <td style="text-align:center"><button class="btn ghost small" data-action="remove" data-id="${it.id}" style="padding:4px 8px" title="Eliminar item">✕</button></td>
    `;
    itemsBody.appendChild(tr);
  });
  updateTotalsPreview();
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    if (document.getElementById('auto_update')?.checked) generatePreview();
  }, 300);
}

function calculateTotals() {
  const subtotal = items.reduce((s, it) => s + (Number(it.qty || 0) * Number(it.price || 0)), 0);
  const igv = subtotal * 0.18;
  return { subtotal, igv, total: subtotal + igv };
}

function updateTotalsPreview() {
  const totals = calculateTotals();
  const curr = getCurrency();
  document.getElementById('totals_preview').innerHTML = `
    <div class="totals-preview-row"><span>Subtotal:</span><span>${formatMoney(totals.subtotal, curr)}</span></div>
    <div class="totals-preview-row"><span>IGV (18%):</span><span>${formatMoney(totals.igv, curr)}</span></div>
    <div class="totals-preview-row total"><span>TOTAL:</span><span>${formatMoney(totals.total, curr)}</span></div>
  `;
}

// ========== PDF: genera el PDF directamente desde HTML string ==========
function downloadPdf(filename, mode = 'save') {
  // A4 en px a 96dpi
  const A4_W = 794;

  const sheetEl = document.querySelector('.sheet');

  // Wrapper fuera de pantalla con ancho A4 exacto
  const wrapper = document.createElement('div');
  wrapper.style.cssText = `
  position: fixed;
  left: 0;
  top: 0;
  width: 210mm;
  background: white;
`;
  wrapper.innerHTML = sheetEl.outerHTML;
  document.body.appendChild(wrapper);

  const clone = wrapper.firstElementChild;
  clone.style.cssText = `
    width: ${A4_W}px !important;
    padding: 20px 28px !important;
    box-sizing: border-box !important;
    background: white !important;
    box-shadow: none !important;
    margin: 0 !important;
    min-height: unset !important;
  `;

  // Esperar imágenes
  const imgs = wrapper.querySelectorAll('img');
  const waits = Array.from(imgs).map(img =>
    img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r; })
  );

  return Promise.all(waits).then(() => {
    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
      scale: 1,
      useCORS: true
      },
      jsPDF: { 
      unit: 'mm', 
      format: 'a4', 
      orientation: 'portrait' 
      }
    };

    if (mode === 'blob') {
      return html2pdf().set(opt).from(clone).toPdf().get('pdf').then(pdf => {
        document.body.removeChild(wrapper);
        return pdf.output('blob');
      });
    } else {
      return html2pdf().set(opt).from(clone).save().then(() => {
        document.body.removeChild(wrapper);
      });
    }
  });
}

function generatePreview() {
  const companyName     = document.getElementById('company_name')?.value || '';
  const companyRuc      = document.getElementById('company_ruc')?.value || '';
  const companyEmail    = document.getElementById('company_email')?.value || '';
  const quoteNumber     = document.getElementById('quote_number')?.value || '';
  const quoteDate       = document.getElementById('quote_date')?.value || new Date().toISOString().slice(0, 10);
  const clientName      = document.getElementById('client_name')?.value || '';
  const clientRuc       = document.getElementById('client_ruc')?.value || '';
  const clientAddress   = document.getElementById('client_address')?.value || '';
  const clientCity      = document.getElementById('client_city')?.value || '';
  const clientPhone     = document.getElementById('client_phone')?.value || '';
  const clientEmail     = document.getElementById('client_email')?.value || '';
  const validityDays    = document.getElementById('validity_days')?.value || 30;
  const commercialNotes = document.getElementById('commercial_notes')?.value || '';
  const curr   = getCurrency();
  const totals = calculateTotals();

  const dateObj = new Date(quoteDate + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('es-PE', { year: 'numeric', month: '2-digit', day: '2-digit' });

  let itemsHtml = '';
  items.forEach((it) => {
    const lineTotal = Number(it.qty || 0) * Number(it.price || 0);
    itemsHtml += `
      <tr>
        <td>${escapeHtml(it.desc || '')}</td>
        <td style="text-align:center">${it.qty || 0}</td>
        <td style="text-align:right">${formatMoney(it.price || 0, curr)}</td>
        <td style="text-align:right;font-weight:600">${formatMoney(lineTotal, curr)}</td>
      </tr>`;
  });
  if (items.length === 0) {
    itemsHtml = '<tr><td colspan="4" style="text-align:center;color:#999;padding:30px">No hay items agregados</td></tr>';
  }

  document.getElementById('preview').innerHTML = `
  <div class="sheet">
    <div class="header-top">
      <div class="company-section">
        <img src="${LOGO_PATH}" alt="NOVOTRACE" class="company-logo" />
        <div class="company-details">
          <p class="company-name">${escapeHtml(companyName)}</p>
          <p>Ruc: ${escapeHtml(companyRuc)}</p>
          <p>Av. Pacto andino S/N - LIMA</p>
          <p>e-mail: <span style="color:#0066cc;text-decoration:underline">${escapeHtml(companyEmail)}</span></p>
          <p>TELF.: 992198342</p>
        </div>
      </div>
      <div class="quote-number-box">
        <div class="quote-box-title">COTIZACIÓN</div>
        <div class="quote-box-number">${quoteNumber}</div>
      </div>
    </div>
    <table class="client-data-table">
      <tbody>
        <tr>
          <td class="label-cell">FECHA:</td><td class="data-cell">${formattedDate}</td>
          <td class="label-cell">DIRECCIÓN:</td><td class="data-cell">${escapeHtml(clientAddress)}</td>
        </tr>
        <tr>
          <td class="label-cell">RUC:</td><td class="data-cell">${escapeHtml(clientRuc)}</td>
          <td class="label-cell">CIUDAD:</td><td class="data-cell">${escapeHtml(clientCity)}</td>
        </tr>
        <tr>
          <td class="label-cell">CLIENTE:</td><td class="data-cell">${escapeHtml(clientName)}</td>
          <td class="label-cell">TELEFONO:</td><td class="data-cell">${escapeHtml(clientPhone)}</td>
        </tr>
        <tr>
          <td class="label-cell">E-MAIL:</td><td class="data-cell" colspan="3">${escapeHtml(clientEmail)}</td>
        </tr>
      </tbody>
    </table>
    <div class="items-section">
      <table class="items">
        <thead>
          <tr>
            <th>Descripción</th>
            <th style="width:100px;text-align:center">Cantidad</th>
            <th style="width:130px;text-align:right">Precio Unit.</th>
            <th style="width:130px;text-align:right">Subtotal</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div class="totals-box">
        <div class="total-row"><span>Subtotal</span><span>${formatMoney(totals.subtotal, curr)}</span></div>
        <div class="total-row"><span>Descuento</span><span style="color:#dc3545">-${currencySymbols[curr] || '$'} 0.00</span></div>
        <div class="total-row"><span>IGV (18%)</span><span>${formatMoney(totals.igv, curr)}</span></div>
        <div class="total-row final"><span>TOTAL</span><span>${formatMoney(totals.total, curr)}</span></div>
      </div>
    </div>
    ${commercialNotes ? `
    <div class="notes-section">
      <h3>TÉRMINOS Y CONDICIONES:</h3>
      ${commercialNotes.split('\n').map(line => line.trim() ? `<p>• ${escapeHtml(line)}</p>` : '').join('')}
      <p style="margin-top:12px"><strong>Validez de la oferta:</strong> ${validityDays} días desde la fecha de emisión.</p>
    </div>` : `
    <div class="notes-section">
      <h3>TÉRMINOS Y CONDICIONES:</h3>
      <p>• Tiempo de entrega: inmediato sujeto a stock.</p>
      <p>• Estaremos a disposición para cualquier aclaración que sea necesaria.</p>
      <p style="margin-top:12px"><strong>Validez de la oferta:</strong> ${validityDays} días desde la fecha de emisión.</p>
    </div>`}
    <div class="payment-display">
      <h3>Cuentas para pagos:</h3>
      <table class="payment-table">
        <thead><tr><th style="width:100px">BANCO</th><th>DATOS DE CUENTA</th></tr></thead>
        <tbody>
          <tr>
            <td class="bank-logo"><img src="/imagenes/BCP.png" alt="BCP" /></td>
            <td class="account-data">
              <div><strong>Cta. Soles:</strong> 194-91893576-0-91</div>
              <div><strong>Cta. Dólares:</strong> 194-91893582-0-91</div>
            </td>
          </tr>
          <tr>
            <td class="bank-logo"><img src="/imagenes/BBVA.png" alt="BBVA" /></td>
            <td class="account-data"><div><strong>Cuenta:</strong> 0011-0323-0200559998-36</div></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
  `;
}

function saveNow() {
  const hasData = items.length || document.getElementById('client_name').value || document.getElementById('client_ruc').value;
  if (!hasData) return Promise.resolve({ ok: false });

  const data = {
    company_name: document.getElementById('company_name')?.value || '',
    quote_number: document.getElementById('quote_number')?.value || '',
    client_name:  document.getElementById('client_name')?.value  || '',
    client_ruc:   document.getElementById('client_ruc')?.value   || '',
    client_email: document.getElementById('client_email')?.value || '',
    client_phone: document.getElementById('client_phone')?.value || '',
    client_city:  document.getElementById('client_city')?.value  || '',
    total: calculateTotals().total,
    currency: getCurrency(),
    items: items
  };

  return fetch('/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })
  .then(res => res.json())
  .then(res => { console.log('Guardado:', res); return res; })
  .catch(err => { console.error('ERROR GUARDANDO:', err); return { ok: false }; });
}

async function newQuote() {
  const res = await saveNow();
  if (!res?.ok) { alert('No se guardó la cotización'); return; }
  await fetchNextQuoteNumber();
  items = [];
  document.getElementById('client_name').value    = '';
  document.getElementById('client_ruc').value     = '';
  document.getElementById('client_address').value = '';
  document.getElementById('client_city').value    = '';
  document.getElementById('client_phone').value   = '';
  document.getElementById('client_email').value   = '';
  renderItemsTable();
  updateTotalsPreview();
}

// ========== EVENTOS ==========
document.addEventListener('DOMContentLoaded', async function () {
  const itemsBody = document.getElementById('items_body');

  await fetchNextQuoteNumber();
  document.getElementById('quote_date').value = new Date().toISOString().slice(0, 10);

  const savedTerms = localStorage.getItem('terms');
  document.getElementById('commercial_notes').value = savedTerms || DEFAULT_TERMS;
  document.getElementById('commercial_notes').addEventListener('input', (e) => {
    localStorage.setItem('terms', e.target.value);
  });

  itemsBody.addEventListener('input', function (e) {
    const el = e.target;
    const field = el.dataset.field;
    if (!field) return;
    const item = items.find(i => i.id === el.dataset.id);
    if (!item) return;
    item[field] = field === 'desc' ? el.value : Number(el.value);
    el.closest('tr').querySelector('.total-cell').textContent = formatMoney((item.qty || 0) * (item.price || 0), getCurrency());
    updateTotalsPreview();
    if (document.getElementById('auto_update')?.checked) generatePreview();
  });

  itemsBody.addEventListener('click', function (e) {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn) return;
    items = items.filter(i => i.id !== btn.dataset.id);
    renderItemsTable();
  });

  document.getElementById('add_item').addEventListener('click', () => {
    items.push({ id: crypto.randomUUID(), desc: 'Nuevo producto/servicio', qty: 1, price: 0 });
    renderItemsTable();
  });

  document.getElementById('clear_items').addEventListener('click', async () => {
    const ok = await customConfirm({ icon: '🧹', title: '¿Eliminar todos los items?', msg: 'Se borrarán todos los productos de esta cotización.', okClass: 'danger', okText: 'Eliminar todo' });
    if (ok) { items.length = 0; renderItemsTable(); }
  });

  const fieldsToWatch = ['company_name','company_email','quote_number','quote_date','client_name','client_ruc','client_address','client_city','client_phone','client_email','currency','validity_days','commercial_notes'];
  fieldsToWatch.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', () => {
      updateTotalsPreview();
      if (document.getElementById('auto_update')?.checked) generatePreview();
    });
  });

  document.getElementById('preview_btn').addEventListener('click', generatePreview);

  // ✅ IMPRIMIR / PDF
  document.getElementById('print_btn').addEventListener('click', async () => {
    await saveNow();
    generatePreview();

    const quoteNumber = document.getElementById('quote_number')?.value || 'Borrador';

    setTimeout(async () => {
      const blob = await downloadPdf(`cot.001-${quoteNumber}.novotrace.pdf`, 'blob');
      const url = URL.createObjectURL(blob);
      document.getElementById('pdf_viewer').src = url;
      document.getElementById('pdf_modal').classList.remove('hidden');
    }, 400);
  });

  // ✅ NUEVA COTIZACIÓN
  document.getElementById('new_quote_btn').addEventListener('click', async () => {
    const ok = await customConfirm({ icon: '📄', title: '¿Crear nueva cotización?', msg: 'Se guardará la actual y se limpiará el formulario.', okClass: 'success-confirm', okText: 'Crear nueva' });
    if (ok) await newQuote();
  });

  // ✅ HISTORIAL
  document.getElementById('history_btn').addEventListener('click', () => {
    fetch('/quotes')
      .then(res => res.json())
      .then(history => {
        const modal = document.getElementById('history_modal');
        const body  = document.getElementById('history_body');
        body.innerHTML = '';

        if (!history.length) {
          body.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:#999">No hay cotizaciones guardadas</td></tr>`;
        } else {
          history.forEach(q => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td>${q.quote_number}</td>
              <td>${q.client_name  || '-'}</td>
              <td>${q.client_ruc   || '-'}</td>
              <td>${q.client_email || '-'}</td>
              <td>${q.client_phone || '-'}</td>
              <td>${q.client_city  || '-'}</td>
              <td>${new Date(q.created_at || Date.now()).toLocaleDateString('es-PE')}</td>
              <td>${formatMoney(q.total || 0, q.currency || 'USD')}</td>
              <td style="display:flex;gap:6px;justify-content:center">
                <button class="btn ghost small download-btn" data-id="${q.id}" data-number="${q.quote_number}" title="Descargar PDF" style="padding:4px 8px">📄</button>
                <button class="btn ghost small delete-quote-btn" data-id="${q.id}" title="Eliminar" style="color:#dc3545;padding:4px 8px">🗑️</button>
              </td>
            `;
            body.appendChild(tr);
          });

          body.querySelectorAll('.delete-quote-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const ok = await customConfirm({ icon: '🗑️', title: '¿Eliminar cotización?', msg: 'Esta acción no se puede deshacer.', okClass: 'danger', okText: 'Eliminar' });
              if (!ok) return;
              fetch(`/quotes/${btn.dataset.id}`, { method: 'DELETE' })
                .then(res => res.json())
                .then(() => btn.closest('tr').remove())
                .catch(err => console.error(err));
            });
          });
        }
        modal.classList.remove('hidden');
      })
      .catch(err => console.error(err));
  });

  // ✅ DESCARGAR PDF DESDE HISTORIAL
  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('.download-btn');
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳';
    btn.disabled = true;

    try {
      const id     = btn.dataset.id;
      const number = btn.dataset.number;

      const [quoteData, itemsData] = await Promise.all([
        fetch(`/quotes/${id}`).then(r => r.json()),
        fetch(`/quotes/${id}/items`).then(r => r.json())
      ]);

      document.getElementById('quote_number').value  = quoteData.quote_number || '';
      document.getElementById('client_name').value   = quoteData.client_name  || '';
      document.getElementById('client_ruc').value    = quoteData.client_ruc   || '';
      document.getElementById('client_email').value  = quoteData.client_email || '';
      document.getElementById('client_phone').value  = quoteData.client_phone || '';
      document.getElementById('client_city').value   = quoteData.client_city  || '';
      if (document.getElementById('client_address'))
        document.getElementById('client_address').value = quoteData.client_address || '';

      items = itemsData.map(it => ({ id: crypto.randomUUID(), desc: it.desc, qty: it.qty, price: it.price }));

      renderItemsTable();
      updateTotalsPreview();
      generatePreview();

      setTimeout(async () => {
        await downloadPdf(`cot.001-${number}.novotrace.pdf`, 'save');
        btn.innerHTML = originalText;
        btn.disabled = false;
      }, 400);

    } catch (err) {
      console.error('Error al descargar desde el historial:', err);
      btn.innerHTML = originalText;
      btn.disabled = false;
      alert('Hubo un error al descargar.');
    }
  });

  // ✅ CERRAR HISTORIAL
  document.addEventListener('click', (e) => {
    if (e.target.closest('#close_history')) {
      document.getElementById('history_modal').classList.add('hidden');
    }
  });

  // ✅ INIT
  async function initApp() {
    await fetchNextQuoteNumber();
    if (items.length === 0) {
      items.push({ id: crypto.randomUUID(), desc: 'Nuevo producto/servicio', qty: 1, price: 0 });
    }
    renderItemsTable();
    updateTotalsPreview();
    generatePreview();
  }

  initApp();
});

// ✅ CERRAR VISOR DE PDF
document.getElementById('close_pdf')?.addEventListener('click', () => {
  document.getElementById('pdf_modal').classList.add('hidden');
  document.getElementById('pdf_viewer').src = '';
});