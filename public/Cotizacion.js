let items = [];
const LOGO_PATH = '/imagenes/Recurso 43.png';
const QUOTE_START_NUMBER = 3000;

let saveTimeout;
let lastSavedQuote = ''; 

const currencySymbols = {
  'USD': '$',
  'PEN': 'S/',
  'EUR': '€'
};

const DEFAULT_TERMS = `Tiempo de entrega: inmediato sujeto a stock.
Estaremos a disposición para cualquier aclaración que sea necesaria.`;

function getNextQuoteNumber() {
  const currentNumber = Number(localStorage.getItem('lastQuoteNumber'));
  return isNaN(currentNumber) ? QUOTE_START_NUMBER : currentNumber;
}

function incrementQuoteNumber() {
  const nextNumber = getNextQuoteNumber() + 1;
  localStorage.setItem('lastQuoteNumber', nextNumber);
  return nextNumber;
}

function initializeQuoteNumber() {
  const quoteNumber = incrementQuoteNumber();
  document.getElementById('quote_number').value = quoteNumber;
}

function formatMoney(v, curr = 'USD') {
  const symbol = currencySymbols[curr] || '$';
  return `${symbol} ${Number(v).toLocaleString('es-PE', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  })}`.replace(/,/g, ' ');
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
  
  items.forEach((it, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'fade-in';
    const total = (it.qty || 0) * (it.price || 0);
    
    tr.innerHTML = `
      <td>
        <input 
          data-id="${it.id}"
          data-field="desc" 
          value="${escapeHtml(it.desc || '')}" 
          style="width:100%;border:0;background:transparent;font-size:13px"
        />
      </td>
      <td>
        <input 
          data-id="${it.id}"
          data-field="qty" 
          type="number" 
          min="0" 
          value="${it.qty || 1}" 
          style="width:100%;border:0;background:transparent;font-size:13px"
        />
      </td>
      <td>
        <input 
          data-id="${it.id}"
          data-field="price" 
          type="number" 
          min="0" 
          step="0.01" 
          value="${it.price || 0}" 
          style="width:100%;border:0;background:transparent;font-size:13px"
        />
      </td>
      <td style="text-align:right;font-size:13px;font-weight:600" class="total-cell">
        ${formatMoney(total, getCurrency())}
      </td>
      <td style="text-align:center">
        <button 
          class="btn ghost small" 
          data-action="remove" 
          data-id="${it.id}"
          style="padding:4px 8px"
        >
          ✕
        </button>
      </td>
    `;
    
    itemsBody.appendChild(tr);
  });
  
  updateTotalsPreview();
  
if (document.getElementById('auto_update')?.checked) {
  requestAnimationFrame(generatePreview);
}
}

function calculateTotals() {
  const subtotal = items.reduce((s, it) => {
    return s + (Number(it.qty || 0) * Number(it.price || 0));
  }, 0);
  
  const igv = subtotal * 0.18;
  const total = subtotal + igv;
  
  return { subtotal, igv, total };
}

function updateTotalsPreview() {
  const totals = calculateTotals();
  const curr = getCurrency();
  
  document.getElementById('totals_preview').innerHTML = `
    <div class="totals-preview-row">
      <span>Subtotal:</span>
      <span>${formatMoney(totals.subtotal, curr)}</span>
    </div>
    <div class="totals-preview-row">
      <span>IGV (18%):</span>
      <span>${formatMoney(totals.igv, curr)}</span>
    </div>
    <div class="totals-preview-row total">
      <span>TOTAL:</span>
      <span>${formatMoney(totals.total, curr)}</span>
    </div>
  `;
}

function generatePreview() {
  const companyName = document.getElementById('company_name')?.value || ''
  const companyRuc = document.getElementById('company_ruc')?.value || '';
  const companyEmail = document.getElementById('company_email')?.value || '';
  const quoteNumber = document.getElementById('quote_number')?.value || '';
  const quoteDate = document.getElementById('quote_date')?.value || new Date().toISOString().slice(0, 10);
  const clientName = document.getElementById('client_name')?.value || '';
  const clientRuc = document.getElementById('client_ruc')?.value || '';
  const clientAddress = document.getElementById('client_address')?.value || '';
  const clientCity = document.getElementById('client_city')?.value || '';
  const clientPhone = document.getElementById('client_phone')?.value || '';
  const clientEmail = document.getElementById('client_email')?.value || '';
  const validityDays = document.getElementById('validity_days')?.value || 30;
  const commercialNotes = document.getElementById('commercial_notes')?.value || '';
  const curr = getCurrency();
  const totals = calculateTotals();

  const dateObj = new Date(quoteDate + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('es-PE', { 
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  let itemsHtml = '';
  items.forEach((it) => {
    const lineTotal = (Number(it.qty || 0) * Number(it.price || 0));
    itemsHtml += `
      <tr>
        <td>${escapeHtml(it.desc || '')}</td>
        <td style="text-align:center">${it.qty || 0}</td>
        <td style="text-align:right">${formatMoney(it.price || 0, curr)}</td>
        <td style="text-align:right;font-weight:600">${formatMoney(lineTotal, curr)}</td>
      </tr>
    `;
  });

  if (items.length === 0) {
    itemsHtml = '<tr><td colspan="4" style="text-align:center;color:#999;padding:30px">No hay items agregados</td></tr>';
  }

  document.getElementById('preview').innerHTML = `
    <!-- Header con Logo, Info Empresa y Cotización -->
    <div class="header-top">
      <div class="company-section">
        <img src="${LOGO_PATH}" alt="NOVOTRACE" class="company-logo" />
        <div class="company-details">
          <p class="company-name">${escapeHtml(companyName)}</p>
          <p>Ruc: ${escapeHtml(companyRuc)}</p>
          <p>Av. Pacto andino S/N - LIMA</p>
          <p>e-mail: <span style="color: #0066cc; text-decoration: underline">${escapeHtml(companyEmail)}</span></p>
          <p>TELF.: 992198342</p>
        </div>
      </div>
      <div class="quote-number-box">
        <div class="quote-box-title">COTIZACIÓN</div>
        <div class="quote-box-number">${quoteNumber}</div>
      </div>
    </div>

    <!-- Tabla de Datos del Cliente -->
    <table class="client-data-table">
      <tbody>
        <tr>
          <td class="label-cell">FECHA:</td>
          <td class="data-cell">${formattedDate}</td>
          <td class="label-cell">DIRECCIÓN:</td>
          <td class="data-cell">${escapeHtml(clientAddress)}</td>
        </tr>
        <tr>
          <td class="label-cell">RUC:</td>
          <td class="data-cell">${escapeHtml(clientRuc)}</td>
          <td class="label-cell">CIUDAD:</td>
          <td class="data-cell">${escapeHtml(clientCity)}</td>
        </tr>
        <tr>
          <td class="label-cell">CLIENTE:</td>
          <td class="data-cell">${escapeHtml(clientName)}</td>
          <td class="label-cell">TELEFONO:</td>
          <td class="data-cell">${escapeHtml(clientPhone)}</td>
        </tr>
        <tr>
          <td class="label-cell">E-MAIL:</td>
          <td class="data-cell" colspan="3">${escapeHtml(clientEmail)}</td>
        </tr>
      </tbody>
    </table>

    <!-- Tabla de Productos -->
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
      
      <!-- Totales -->
      <div class="totals-box">
        <div class="total-row">
          <span>Subtotal</span>
          <span>${formatMoney(totals.subtotal, curr)}</span>
        </div>
        <div class="total-row">
          <span>Descuento</span>
          <span style="color:#dc3545">-${currencySymbols[curr] || '$'} 0.00</span>
        </div>
        <div class="total-row">
          <span>IGV (18%)</span>
          <span>${formatMoney(totals.igv, curr)}</span>
        </div>
        <div class="total-row final">
          <span>TOTAL</span>
          <span>${formatMoney(totals.total, curr)}</span>
        </div>
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

<!-- Medios de Pago -->
<div class="payment-display">
  <h3>Cuentas para pagos:</h3>
  <table class="payment-table">
    <thead>
      <tr>
        <th style="width:100px">BANCO</th>
        <th>DATOS DE CUENTA</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="bank-logo">
          <img src="/imagenes/BCP.png" alt="BCP" />
        </td>
        <td class="account-data">
          <div><strong>Cta. Soles:</strong> 194-91893576-0-91</div>
          <div><strong>Cta. Dólares:</strong> 194-91893582-0-91</div>
        </td>
      </tr>
      <tr>
        <td class="bank-logo">
          <img src="/imagenes/BBVA.png" alt="BBVA" />
        </td>
        <td class="account-data">
          <div><strong>Cuenta:</strong> 0011-0323-0200559998-36</div>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`;
}

// ========== NUEVA COTIZACIÓN ==========
function newQuote() {
  saveNow(); // guarda UNA sola vez

  items.length = 0;

  initializeQuoteNumber();
  document.getElementById('quote_date').value = new Date().toISOString().slice(0, 10);

  document.getElementById('client_name').value = '';
  document.getElementById('client_ruc').value = '';
  document.getElementById('client_address').value = '';
  document.getElementById('client_city').value = '';
  document.getElementById('client_phone').value = '';
  document.getElementById('client_email').value = '';
}

function saveNow() {
  const data = {
    quote_number: document.getElementById('quote_number')?.value || '',
    company_name: document.getElementById('company_name')?.value || '',
    client_name: document.getElementById('client_name')?.value || '',
    client_ruc: document.getElementById('client_ruc')?.value || '',
    client_email: document.getElementById('client_email')?.value || '',
    client_phone: document.getElementById('client_phone')?.value || '',
    client_city: document.getElementById('client_city')?.value || '',
    total: calculateTotals().total,
    items: items
  };

  fetch('/save', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(data)
  })
  .then(() => console.log("Guardado ✔"))
  .catch(err => console.error(err));
}

  // ========== EVENTOS ==========
document.addEventListener('DOMContentLoaded', function() {
  const itemsBody = document.getElementById('items_body');

  initializeQuoteNumber();
  document.getElementById('quote_date').value = new Date().toISOString().slice(0, 10);

  const savedTerms = localStorage.getItem('terms');
  document.getElementById('commercial_notes').value = savedTerms || DEFAULT_TERMS;

  document.getElementById('commercial_notes').addEventListener('input', (e) => {
    localStorage.setItem('terms', e.target.value);
  });

  // ===== ITEMS =====
  itemsBody.addEventListener('input', function(e) {
    const el = e.target;
    const id = el.dataset.id;
    const field = el.dataset.field;
    if (!field) return;

    const item = items.find(i => i.id === id);
    if (!item) return;

    item[field] = field === 'desc' ? el.value : Number(el.value);

    const row = el.closest('tr');
    const totalCell = row.querySelector('.total-cell');

    totalCell.textContent = formatMoney(
      (item.qty || 0) * (item.price || 0),
      getCurrency()
    );

    updateTotalsPreview();

    if (document.getElementById('auto_update')?.checked) {
      generatePreview();
    }

    //autoSave();
  });

  itemsBody.addEventListener('click', function(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const id = btn.dataset.id;
    items = items.filter(i => i.id !== id);
    renderItemsTable();
  });

  document.getElementById('add_item').addEventListener('click', () => {
    items.push({
      id: crypto.randomUUID(),
      desc: 'Nuevo producto/servicio',
      qty: 1,
      price: 0
    });
    renderItemsTable();
  });

  document.getElementById('clear_items').addEventListener('click', () => {
    if (confirm('¿Eliminar todos los items?')) {
      items.length = 0;
      renderItemsTable();
    }
  });

  const fieldsToWatch = [
    'company_name','company_email','quote_number','quote_date',
    'client_name','client_ruc','client_address','client_city',
    'client_phone','client_email','currency','validity_days','commercial_notes'
  ];

  fieldsToWatch.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        updateTotalsPreview();
        if (document.getElementById('auto_update').checked) {
          generatePreview();
        }
        //autoSave();
      });
    }
  });

  document.getElementById('preview_btn').addEventListener('click', generatePreview);

  document.getElementById('print_btn').addEventListener('click', () => {
    generatePreview();
    setTimeout(() => window.print(), 300);
  });

  document.getElementById('new_quote_btn').addEventListener('click', () => {
    if (confirm('¿Crear nueva cotización?')) {
      newQuote();
    }
  });

  // =========================
  // ✅ HISTORIAL (ARREGLADO)
  // =========================
  document.getElementById('history_btn').addEventListener('click', () => {
    fetch('/quotes')
      .then(res => res.json())
      .then(history => {
        const modal = document.getElementById('history_modal');
        const body = document.getElementById('history_body');

        body.innerHTML = '';

        if (!history.length) {
          body.innerHTML = `
            <tr>
              <td colspan="8" style="text-align:center;padding:20px;color:#999">
                No hay cotizaciones guardadas
              </td>
            </tr>
          `;
        } else {
          history.forEach(q => {
            const tr = document.createElement('tr');

            tr.innerHTML = `
              <td>${q.quote_number}</td>
              <td>${q.client_name || '-'}</td>
              <td>${q.client_ruc || '-'}</td>
              <td>${q.client_email || '-'}</td>
              <td>${q.client_phone || '-'}</td>
              <td>${q.client_city || '-'}</td>
              <td>${new Date(q.created_at || Date.now()).toLocaleDateString('es-PE')}</td>
              <td>${formatMoney(q.total || 0, getCurrency())}</td>
            `;

            body.appendChild(tr);
          });
        }

        modal.classList.remove('hidden');
      })
      .catch(err => console.error(err));
  });

  // =========================
  // ✅ BOTÓN ❌ FUNCIONA
  // =========================
  document.getElementById('close_history').addEventListener('click', () => {
    document.getElementById('history_modal').classList.add('hidden');
  });

  // INIT
  updateTotalsPreview();
  renderItemsTable();
});

//function autoSave() {
  //clearTimeout(saveTimeout);

  //saveTimeout = setTimeout(() => {
   // saveNow(); // reutilizamos tu función buena
  //}, 800);
//}