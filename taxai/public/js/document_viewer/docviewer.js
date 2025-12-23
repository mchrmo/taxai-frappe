/**
 * Document Viewer Component
 * Renders a split view with PDF preview and extracted data
 * Integrated with Frappe framework
 */

window.renderDocumentViewer = function (frm) {
  const extractedData = JSON.parse(frm.doc.extracted_data || '{}');
  const fileUrl = frm.doc.file_url;

  // Check if extracted_data is empty or not set
  const isDataEmpty = !frm.doc.extracted_data ||
    frm.doc.extracted_data === '{}' ||
    !extractedData.classification ||
    !extractedData.classification.type;

  // If data is empty, show extract button
  if (isDataEmpty) {
    const emptyStateHtml = `
      <!doctype html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="/assets/taxai/js/document_viewer/output.css" rel="stylesheet">
        <style>
          body {
            margin: 0;
            padding: 0;
          }
        </style>
      </head>
      <div style="height: 80vh;" class="overflow-auto bg-gray-50">
        <div class="flex flex-col h-100">
          <div class="flex flex-1 overflow-hidden">
            <!-- LEFT COLUMN: Document Preview -->
            <div class="flex-1 min-w-0 border-r border-gray-200 bg-white p-4">
              <embed id="documentPreview" src="${fileUrl}" type="application/pdf"
                class="w-full h-full border border-gray-300 rounded-lg" />
            </div>
            <!-- RIGHT COLUMN: Extract Button -->
            <div class="w-[500px] flex-none flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 p-8">
              <div class="text-center">
                <svg class="w-24 h-24 mx-auto mb-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                </svg>
                <h3 class="text-xl font-medium text-gray-900 mb-2">No Data Extracted</h3>
                <p class="text-sm text-gray-600 mb-8">Extract data from the document to start editing</p>
                <button onclick="extractDocumentData()" 
                  class="px-8 py-3 text-base font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg hover:from-blue-700 hover:to-indigo-700 cursor-pointer transition-all duration-200 shadow-lg hover:shadow-xl">
                  Extract Data
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      </html>
    `;

    frm.fields_dict.document_viewer_html.$wrapper.html(emptyStateHtml);

    const section = cur_frm.fields_dict.document_viewer_html.$wrapper.parent().parent().parent();
    section.removeClass('section-body');
    section.parent().removeClass('form-section');

    // Define extract function
    window.extractDocumentData = function () {
      frappe.show_alert({
        message: __('Extracting data from document...'),
        indicator: 'blue'
      }, 3);

      // Call extraction API
      frappe.call({
        method: "taxai.taxai.doctype.incoming_document.incoming_document.startExtraction",
        args: {
          document_name: cur_frm.doc.name
        },
        freeze: true,
        callback: function (response) {
          frappe.show_alert(__('Document is being processed'), 5);
        }
      });
    };

    return;
  }

  // Load validation script first
  frappe.require('/assets/taxai/js/document_viewer/document_validations.js', function () {
    console.log('Validation script loaded, Validations available:', typeof Validations !== 'undefined');

    // Load HTML template
    const templateUrl = '/assets/taxai/js/document_viewer/index.html';

    fetch(templateUrl)
      .then(response => response.text())
      .then(templateHtml => {
        // Replace {{fileUrl}} placeholder with actual file URL
        const html = templateHtml.replace('{{fileUrl}}', fileUrl);

        // Inject HTML into form field
        frm.fields_dict.document_viewer_html.$wrapper.html(html);

        const section = cur_frm.fields_dict.document_viewer_html.$wrapper.parent().parent().parent();
        section.removeClass('section-body');
        section.parent().removeClass('form-section');

        // Initialize the viewer after DOM is ready
        // Increased timeout to ensure Validations is loaded
        setTimeout(() => {
          console.log('About to call loadExtractedData, Validations available:', typeof Validations !== 'undefined');
          if (typeof loadExtractedData === 'function') {
            loadExtractedData(extractedData);
          }
        }, 200);
      })
      .catch(error => {
        console.error('Error loading document viewer template:', error);
        frm.fields_dict.document_viewer_html.$wrapper.html(
          '<div style="padding: 2rem; text-align: center; color: #666;">Error loading document viewer</div>'
        );
      });
  });
};

/**
 * Document Viewer Component
 * Loads and displays extracted data from invoices, receipts, and other documents
 */

// Store current data for re-rendering
let currentData = null;

/**
 * Show error message under a field
 */
function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  // Remove any existing error message
  clearFieldError(fieldId);

  // Add error styling to field
  field.classList.add('border-red-500');
  field.classList.remove('border-gray-300');

  // Create error message element
  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error text-xs text-red-600 mt-1 break-words';
  errorDiv.textContent = message;
  errorDiv.id = `${fieldId}-error`;

  // Insert error message after field's container
  const parent = field.parentNode;

  // Check if parent is a flex container (for currency fields with symbols)
  if (parent && parent.classList.contains('flex')) {
    // Field is in a flex container with currency symbol
    // Insert after the flex container, within the same grid cell
    parent.parentNode.insertBefore(errorDiv, parent.nextSibling);
  }
  // Check if field is wrapped in a simple div container (common for date fields)
  else if (parent && parent.tagName === 'DIV' && parent.children.length === 1) {
    // Field is wrapped in a container div, insert after the container
    parent.parentNode.insertBefore(errorDiv, parent.nextSibling);
  }
  else {
    // Field is not wrapped, insert directly after field
    parent.insertBefore(errorDiv, field.nextSibling);
  }
}

/**
 * Clear error message from a field
 */
function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  // Remove error styling
  field.classList.remove('border-red-500');
  field.classList.add('border-gray-300');

  // Remove error message
  const errorDiv = document.getElementById(`${fieldId}-error`);
  if (errorDiv) {
    errorDiv.remove();
  }
}

/**
 * Clear all field errors
 */
function clearAllFieldErrors() {
  // Clear all error messages
  document.querySelectorAll('.field-error').forEach(el => el.remove());

  // Remove error styling from all inputs
  document.querySelectorAll('input.border-red-500, select.border-red-500, textarea.border-red-500').forEach(field => {
    field.classList.remove('border-red-500');
    field.classList.add('border-gray-300');
  });
}

// HTML Templates (loaded from external files for separation of concerns)
const Templates = {
  receiptItemRow: `
<tr>
  <td>{{description}}</td>
  <td>{{quantity}}</td>
  <td>{{unit}}</td>
  <td>{{unit_price}}</td>
  <td>{{vat_rate}}</td>
  <td>{{line_total}}</td>
</tr>`,

  invoiceItemCard: `
<div class="bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm">
  <div class="flex items-start gap-2 mb-3 min-w-0">
    <span class="flex-none w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">{{index}}</span>
    <input type="text" 
           class="flex-1 min-w-0 px-2 py-1.5 text-sm font-medium border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
           value="{{description}}" 
           placeholder="Item description"
           data-field="description"
           data-index="{{itemIndex}}" />
    <button class="item-delete-btn flex-none w-6 h-6 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center text-sm font-medium cursor-pointer transition-colors" data-index="{{itemIndex}}" title="Delete item">×</button>
  </div>
  <div class="grid grid-cols-4 gap-2">
    <div class="col-span-1 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Množstvo</label>
      <input type="number" 
             class="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
             value="{{quantity}}"
             step="0.01"
             data-field="quantity"
             data-index="{{itemIndex}}" />
    </div>
    <div class="col-span-1 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Jednotka</label>
      <input type="text" 
             class="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
             value="{{unit}}"
             data-field="unit"
             data-index="{{itemIndex}}" />
    </div>
    <div class="col-span-2 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Jedn. cena bez DPH</label>
      <div class="flex min-w-0">
        <span class="inline-flex items-center px-2 text-xs font-medium text-gray-700 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md currency-symbol">EUR</span>
        <input type="number" 
               class="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
               value="{{unit_price}}"
               step="0.01"
               data-field="unit_price"
               data-index="{{itemIndex}}" />
      </div>
    </div>
    <div class="col-span-1 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">DPH %</label>
      <input type="number" 
             class="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
             value="{{vat_rate}}"
             step="1"
             data-field="vat_rate"
             data-index="{{itemIndex}}" />
    </div>
    <div class="col-span-3 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Spolu bez DPH</label>
      <div class="flex min-w-0">
        <span class="inline-flex items-center px-2 text-xs font-medium text-gray-700 bg-blue-50 border border-r-0 border-blue-300 rounded-l-md currency-symbol">EUR</span>
        <input type="number" 
               class="flex-1 min-w-0 px-2 py-1 text-sm font-medium border border-blue-300 rounded-r-md bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
               value="{{line_total}}"
               step="0.01"
               data-field="line_total"
               data-index="{{itemIndex}}" />
      </div>
    </div>
    <div class="col-span-4 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Spolu s DPH</label>
      <div class="flex min-w-0">
        <span class="inline-flex items-center px-2 text-xs font-medium text-gray-700 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md currency-symbol">EUR</span>
        <input type="number" 
               class="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
               value="{{line_total_with_vat}}"
               step="0.01"
               data-field="line_total_with_vat"
               data-index="{{itemIndex}}" />
      </div>
    </div>
  </div>
</div>`,

  receiptItemCard: `
<div class="bg-white border border-gray-200 rounded-lg p-3 mb-3 shadow-sm">
  <div class="flex items-start gap-2 mb-3 min-w-0">
    <span class="flex-none w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-medium">{{index}}</span>
    <input type="text" 
           class="flex-1 min-w-0 px-2 py-1.5 text-sm font-medium border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" 
           value="{{description}}" 
           placeholder="Item description"
           data-field="description"
           data-index="{{itemIndex}}" />
    <button class="item-delete-btn flex-none w-6 h-6 bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center justify-center text-sm font-medium cursor-pointer transition-colors" data-index="{{itemIndex}}" title="Delete item">×</button>
  </div>
  <div class="grid grid-cols-4 gap-2">
    <div class="col-span-1 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Množstvo</label>
      <input type="number"
             class="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" 
             value="{{quantity}}"
             step="0.01"
             data-field="quantity"
             data-index="{{itemIndex}}" />
    </div>
    <div class="col-span-1 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Jednotka</label>
      <input type="text" 
             class="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" 
             value="{{unit}}"
             data-field="unit"
             data-index="{{itemIndex}}" />
    </div>
    <div class="col-span-2 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Jedn. cena</label>
      <div class="flex min-w-0">
        <span class="inline-flex items-center px-2 text-xs font-medium text-gray-700 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md currency-symbol">EUR</span>
        <input type="number" 
               class="flex-1 min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-r-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" 
               value="{{unit_price}}"
               step="0.01"
               data-field="unit_price"
               data-index="{{itemIndex}}" />
      </div>
    </div>
    <div class="col-span-1 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">DPH %</label>
      <input type="number" 
             class="w-full min-w-0 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" 
             value="{{vat_rate}}"
             step="1"
             data-field="vat_rate"
             data-index="{{itemIndex}}" />
    </div>
    <div class="col-span-3 min-w-0">
      <label class="block text-xs font-medium text-gray-600 mb-1">Spolu</label>
      <div class="flex min-w-0">
        <span class="inline-flex items-center px-2 text-xs font-medium text-gray-700 bg-green-50 border border-r-0 border-green-300 rounded-l-md currency-symbol">EUR</span>
        <input type="number" 
               class="flex-1 min-w-0 px-2 py-1 text-sm font-medium border border-green-300 rounded-r-md bg-green-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500" 
               value="{{line_total}}"
               step="0.01"
               data-field="line_total"
               data-index="{{itemIndex}}" />
      </div>
    </div>
  </div>
</div>`,

  emptyItemsMessage: `
<div class="px-4 py-8 text-center text-gray-500 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
  No items found. Click "Add Item" to add one.
</div>`
};

/**
 * Replace template variables with actual values
 */
function fillTemplate(template, data) {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    // Use empty string only if value is null or undefined, not for 0 or false
    result = result.replace(regex, value != null ? value : '');
  }
  return result;
}

function loadExtractedData(data) {
  currentData = data;

  // Initialize originalData if not set
  if (typeof window.originalData === 'undefined' || !window.originalData) {
    window.originalData = JSON.parse(JSON.stringify(data));
  }

  const docType = data.classification.type;
  const originalDocType = window.originalData.classification.type;
  const docTypeEl = document.getElementById("docType");
  const confidenceEl = document.getElementById("confidence");
  const documentDirectionEl = document.getElementById("documentDirection");

  if (docTypeEl) {
    docTypeEl.value = docType;
  }
  if (confidenceEl) {
    confidenceEl.textContent = (data.classification.confidence * 100).toFixed(1) + '%';
  }
  
  // Set document direction from Frappe form document_type
  if (documentDirectionEl && typeof cur_frm !== 'undefined' && cur_frm.doc.document_type) {
    // Map document_type back to direction
    const docType = cur_frm.doc.document_type;
    if (docType === 'Purchase Invoice' || docType === 'Cash Receipt') {
      documentDirectionEl.value = 'received';
    } else if (docType === 'Sale Invoice' || docType === 'Cash Payment') {
      documentDirectionEl.value = 'sent';
    } else {
      documentDirectionEl.value = 'unrecognized';
    }
  }

  // Show/hide confidence based on whether type was changed
  const confidenceContainer = document.getElementById("confidenceContainer");

  if (confidenceContainer) {
    if (docType !== originalDocType) {
      confidenceContainer.classList.add('hidden');
    } else {
      confidenceContainer.classList.remove('hidden');
    }
  }

  // Helper function to get proper document_type based on classification and direction
  function getDocumentType(classificationType, direction) {
    if (direction === 'unrecognized') {
      return 'Unrecognized';
    }
    if (classificationType === 'INVOICE') {
      return direction === 'received' ? 'Purchase Invoice' : 'Sale Invoice';
    } else if (classificationType === 'RECEIPT') {
      return direction === 'received' ? 'Cash Receipt' : 'Cash Payment';
    }
    return 'Unrecognized';
  }

  // Add event listener to document type select (remove old listener first)
  const docTypeSelect = document.getElementById("docType");
  const oldListener = docTypeSelect.onchange;
  docTypeSelect.onchange = function () {
    currentData.classification.type = this.value;
    
    // Update document_type in Frappe form based on new classification and current direction
    if (documentDirectionEl && typeof cur_frm !== 'undefined') {
      const newDocType = getDocumentType(this.value, documentDirectionEl.value);
      if (newDocType && cur_frm.doc.document_type !== newDocType) {
        // Update the doc directly without triggering a reload
        cur_frm.doc.document_type = newDocType;
        cur_frm.refresh_field('document_type');
      }
    }
    
    loadExtractedData(currentData);
    if (typeof markAsChanged === 'function') markAsChanged();
  };
  
  // Add event listener to document direction select
  if (documentDirectionEl) {
    documentDirectionEl.onchange = function() {
      // Update Frappe form field based on classification type and direction
      if (typeof cur_frm !== 'undefined') {
        const newDocType = getDocumentType(currentData.classification.type, this.value);
        if (newDocType && cur_frm.doc.document_type !== newDocType) {
          // Update the doc directly without triggering a reload
          cur_frm.doc.document_type = newDocType;
          cur_frm.refresh_field('document_type');
        }
      }
      if (typeof markAsChanged === 'function') markAsChanged();
    };
  }

  // Hide all blocks
  const invoiceBlock = document.getElementById("invoiceBlock");
  const receiptBlock = document.getElementById("receiptBlock");
  const otherBlock = document.getElementById("otherBlock");
  const invoiceTypeBlock = document.getElementById("invoiceTypeBlock");


  if (invoiceBlock) invoiceBlock.classList.add("hidden");
  if (receiptBlock) receiptBlock.classList.add("hidden");
  if (otherBlock) otherBlock.classList.add("hidden");
  if (invoiceTypeBlock) invoiceTypeBlock.classList.add("hidden");

  // ========== INVOICE ==========
  if (docType === "INVOICE") {
    const inv = data.data || {};
    if (invoiceBlock) invoiceBlock.classList.remove("hidden");
    if (invoiceTypeBlock) invoiceTypeBlock.classList.remove("hidden");

    // Populate invoice fields
    Object.keys(inv).forEach((key) => {
      const el = document.getElementById(key);
      if (el && key !== 'items') {
        // For number inputs, use 0 if value is null/undefined, otherwise use empty string
        el.value = (inv[key] != null) ? inv[key] : (el.type === 'number' ? 0 : '');

        // Add event listener for change (use onchange to prevent duplicates)
        el.onchange = function () {
          currentData.data[key] = this.type === 'number' ? parseFloat(this.value) || 0 : this.value;
          if (typeof markAsChanged === 'function') markAsChanged();
          // Validate after change
          validateInvoiceData(currentData.data);
        };
      }
    });

    // Populate items container
    renderInvoiceItems(inv.items || []);

    // Update currency symbols
    updateCurrencySymbols(inv.currency || 'EUR');

    // Add event listener to currency field
    const currencyField = document.getElementById('currency');
    if (currencyField) {
      currencyField.onchange = function () {
        currentData.data.currency = this.value;
        updateCurrencySymbols(this.value || 'EUR');
        if (typeof markAsChanged === 'function') markAsChanged();
        validateInvoiceData(currentData.data);
      };
    }

    // Show/hide associated document field based on invoice type
    const invoiceTypeSelect = document.getElementById('invoice_type');
    const associatedDocBlock = document.getElementById('associatedDocBlock');

    function toggleAssociatedDoc() {
      const invoiceType = invoiceTypeSelect.value;
      if (invoiceType === 'CREDIT_NOTE' || invoiceType === 'DEBIT_NOTE') {
        associatedDocBlock.classList.remove('hidden');
      } else {
        associatedDocBlock.classList.add('hidden');
      }
    }

    toggleAssociatedDoc();
    invoiceTypeSelect.onchange = function () {
      currentData.data.invoice_type = this.value;
      toggleAssociatedDoc();
      if (typeof markAsChanged === 'function') markAsChanged();
      validateInvoiceData(currentData.data);
    };

    // Initial validation
    validateInvoiceData(inv);
  }

  // ========== RECEIPT ==========
  if (docType === "RECEIPT") {
    const rc = data.data || {};
    if (receiptBlock) receiptBlock.classList.remove("hidden");

    // Populate receipt fields
    Object.keys(rc).forEach((key) => {
      let fieldId = key;

      // Map receipt data fields to form field IDs
      if (key === 'date') fieldId = 'receipt_date';
      if (key === 'time') fieldId = 'receipt_time';
      if (key === 'total_with_vat') fieldId = 'receipt_total';
      if (key === 'uid') fieldId = 'receipt_uid';
      if (key === 'currency') fieldId = 'receipt_currency';
      if (key === 'payment_method') fieldId = 'receipt_payment_method';

      const el = document.getElementById(fieldId);
      if (el && key !== 'items') {
        // For number inputs, use 0 if value is null/undefined, otherwise use empty string
        el.value = (rc[key] != null) ? rc[key] : (el.type === 'number' ? 0 : '');

        // Add event listener for change (use onchange to prevent duplicates)
        el.onchange = function () {
          const dataKey = fieldId.replace('receipt_', '');
          currentData.data[dataKey] = this.type === 'number' ? parseFloat(this.value) || 0 : this.value;
          if (typeof markAsChanged === 'function') markAsChanged();
        };
      }
    });

    // Populate items container
    renderReceiptItems(rc.items || []);

    // Update currency symbols
    updateCurrencySymbols(rc.currency || 'EUR');

    // Add event listener to currency field
    const currencyField = document.getElementById('receipt_currency');
    if (currencyField) {
      currencyField.onchange = function () {
        currentData.data.currency = this.value;
        updateCurrencySymbols(this.value || 'EUR');
        if (typeof markAsChanged === 'function') markAsChanged();
      };
    }
  }

  // ========== OTHER ==========
  if (docType === "OTHER") {
    if (otherBlock) otherBlock.classList.remove("hidden");
    const otherNote = document.getElementById("other_note");
    otherNote.value = data.other_data?.note || "";

    // Add event listener for change
    otherNote.onchange = function () {
      if (!currentData.other_data) currentData.other_data = {};
      currentData.other_data.note = this.value;
      if (typeof markAsChanged === 'function') markAsChanged();
    };
  }
}

/**
 * Render invoice items as editable cards
 */
function renderInvoiceItems(items) {
  const container = document.querySelector("#invoiceItemsContainer");

  if (!container) return;

  container.innerHTML = "";

  if (!items || items.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.innerHTML = Templates.emptyItemsMessage;
    container.appendChild(emptyDiv.firstElementChild);
  } else {
    items.forEach((item, index) => {
      const html = fillTemplate(Templates.invoiceItemCard, {
        index: index + 1,
        itemIndex: index,
        description: item.description || '',
        quantity: (item.quantity != null) ? item.quantity : 0,
        unit: item.unit || '',
        unit_price: (item.unit_price != null) ? item.unit_price : 0,
        vat_rate: (item.vat_rate != null) ? item.vat_rate : 0,
        line_total: (item.line_total != null) ? item.line_total : 0,
        line_total_with_vat: (item.line_total_with_vat != null) ? item.line_total_with_vat : 0
      });

      const cardDiv = document.createElement("div");
      cardDiv.innerHTML = html;
      const card = cardDiv.firstElementChild;

      // Attach event listeners to inputs
      card.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', function () {
          const index = parseInt(this.dataset.index);
          const field = this.dataset.field;
          updateItemField(index, field, this.value);
          if (typeof markAsChanged === 'function') markAsChanged();
        });
      });

      // Attach event listener to delete button
      const deleteBtn = card.querySelector('.item-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          const index = parseInt(this.dataset.index);
          deleteItem(index);
        });
      }

      container.appendChild(card);
    });
  }

  // Add "Add New Item" button at the end
  const addButton = document.createElement("button");
  addButton.className = "w-full px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border-2 border-blue-300 border-dashed rounded-lg hover:bg-blue-100 hover:border-blue-400 cursor-pointer transition-colors";
  addButton.innerHTML = "+ Add Item";
  addButton.addEventListener('click', addNewItem);
  container.appendChild(addButton);

  // Update currency symbols in items
  if (currentData && currentData.data && currentData.data.currency) {
    updateCurrencySymbols(currentData.data.currency);
  }
}

/**
 * Render receipt items as editable cards
 */
function renderReceiptItems(items) {
  const container = document.querySelector("#receiptItemsContainer");

  if (!container) return;

  container.innerHTML = "";

  if (!items || items.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.innerHTML = Templates.emptyItemsMessage;
    container.appendChild(emptyDiv.firstElementChild);
  } else {
    items.forEach((item, index) => {
      const html = fillTemplate(Templates.receiptItemCard, {
        index: index + 1,
        itemIndex: index,
        description: item.description || '',
        quantity: (item.quantity != null) ? item.quantity : 0,
        unit: item.unit || '',
        unit_price: (item.unit_price != null) ? item.unit_price : 0,
        vat_rate: (item.vat_rate != null) ? item.vat_rate : 0,
        line_total: (item.line_total != null) ? item.line_total : 0
      });

      const cardDiv = document.createElement("div");
      cardDiv.innerHTML = html;
      const card = cardDiv.firstElementChild;

      // Attach event listeners to inputs
      card.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', function () {
          const index = parseInt(this.dataset.index);
          const field = this.dataset.field;
          updateReceiptItemField(index, field, this.value);
          if (typeof markAsChanged === 'function') markAsChanged();
        });
      });

      // Attach event listener to delete button
      const deleteBtn = card.querySelector('.item-delete-btn');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', function () {
          const index = parseInt(this.dataset.index);
          deleteReceiptItem(index);
        });
      }

      container.appendChild(card);
    });
  }

  // Add "Add New Item" button at the end
  const addButton = document.createElement("button");
  addButton.className = "w-full px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border-2 border-green-300 border-dashed rounded-lg hover:bg-green-100 hover:border-green-400 cursor-pointer transition-colors";
  addButton.innerHTML = "+ Add Item";
  addButton.addEventListener('click', addNewReceiptItem);
  container.appendChild(addButton);

  // Update currency symbols in items
  if (currentData && currentData.data && currentData.data.currency) {
    updateCurrencySymbols(currentData.data.currency);
  }
}

/**
 * Update item field value
 */
function updateItemField(index, field, value) {
  if (!currentData || !currentData.data || !currentData.data.items) return;

  const item = currentData.data.items[index];
  if (!item) return;

  // Parse numeric values
  if (['quantity', 'unit_price', 'vat_rate', 'line_total', 'line_total_with_vat', 'unit_price_with_vat', 'vat_amount'].includes(field)) {
    item[field] = parseFloat(value) || 0;
  } else {
    item[field] = value;
  }

  // Auto-calculate related fields
  if (['quantity', 'unit_price', 'vat_rate'].includes(field)) {
    recalculateItem(item);
    // Update calculated field values in the DOM without re-rendering
    updateCalculatedFields(index, item);
  }

  // Validate after item update
  if (currentData && currentData.classification && currentData.classification.type === 'INVOICE') {
    validateInvoiceData(currentData.data);
  }
}

/**
 * Update calculated field values in the DOM without re-rendering
 */
function updateCalculatedFields(index, item) {
  // Find all inputs for this item and update calculated values
  const container = document.querySelector("#invoiceItemsContainer");
  if (!container) return;

  const inputs = container.querySelectorAll(`input[data-index="${index}"]`);
  inputs.forEach(input => {
    const field = input.dataset.field;
    if (['line_total', 'line_total_with_vat', 'vat_amount', 'unit_price_with_vat'].includes(field)) {
      // Only update if not currently focused to avoid disrupting user input
      if (document.activeElement !== input) {
        input.value = (item[field] != null) ? item[field] : 0;
      }
    }
  });
}

/**
 * Recalculate item totals
 */
function recalculateItem(item) {
  const quantity = parseFloat(item.quantity) || 0;
  const unitPrice = parseFloat(item.unit_price) || 0;
  const vatRate = parseFloat(item.vat_rate) || 0;

  // Calculate line total (base)
  item.line_total = round2(quantity * unitPrice);

  // Calculate VAT amount
  item.vat_amount = round2(item.line_total * (vatRate / 100));

  // Calculate line total with VAT
  item.line_total_with_vat = round2(item.line_total + item.vat_amount);

  // Calculate unit price with VAT
  item.unit_price_with_vat = round2(unitPrice * (1 + vatRate / 100));
}

/**
 * Add new item
 */
function addNewItem() {
  if (!currentData || !currentData.data) return;

  if (!currentData.data.items) {
    currentData.data.items = [];
  }

  // Create new empty item
  const newItem = {
    description: '',
    quantity: 1,
    unit: 'ks',
    unit_price: 0,
    vat_rate: 20,
    line_total: 0,
    line_total_with_vat: 0,
    vat_amount: 0,
    unit_price_with_vat: 0
  };

  currentData.data.items.push(newItem);
  renderInvoiceItems(currentData.data.items);
  if (typeof markAsChanged === 'function') markAsChanged();

  // Validate after adding item
  if (currentData && currentData.classification && currentData.classification.type === 'INVOICE') {
    validateInvoiceData(currentData.data);
  }
}

/**
 * Validate invoice-level data
 */
function validateInvoiceData(invoice) {
  // Check if Validations is available
  if (typeof Validations === 'undefined') {
    console.warn('Validations object not loaded yet');
    return;
  }

  // Clear all previous errors
  clearAllFieldErrors();

  const errors = [];
  const sectionErrors = {
    invoice: [],
    supplier: [],
    buyer: [],
    financial: [],
    payment: []
  };

  // Required fields validation
  const requiredFields = [
    { field: 'supplier_name', section: 'supplier' },
    { field: 'supplier_ico', section: 'supplier' },
    { field: 'buyer_name', section: 'buyer' },
    { field: 'buyer_ico', section: 'buyer' },
    { field: 'invoice_number', section: 'invoice' },
    { field: 'issue_date', section: 'invoice' },
    { field: 'total_with_vat', section: 'financial' }
  ];

  requiredFields.forEach(({ field, section }) => {
    if (!invoice[field] || invoice[field] === '') {
      const message = 'This field is required';
      showFieldError(field, message);
      sectionErrors[section].push(`${field.replace(/_/g, ' ')}: ${message}`);
    }
  });

  // Numeric fields validation
  const numericFields = ['total_base', 'total_vat_amount', 'total_with_vat', 'discount'];
  numericFields.forEach(field => {
    if (invoice[field] != null && isNaN(Number(invoice[field]))) {
      const message = 'Must be a valid number';
      showFieldError(field, message);
      sectionErrors.financial.push(`${field.replace(/_/g, ' ')}: ${message}`);
    }
  });

  // Date validations
  if (invoice.issue_date) {
    const issueDateResult = Validations.validDate(invoice.issue_date, 'Issue date');
    if (!issueDateResult.valid) {
      showFieldError('issue_date', issueDateResult.message);
      errors.push(issueDateResult.message);
      sectionErrors.invoice.push(issueDateResult.message);
    }

    const notFutureResult = Validations.notFuture(invoice.issue_date, 'Issue date');
    if (!notFutureResult.valid) {
      showFieldError('issue_date', notFutureResult.message);
      errors.push(notFutureResult.message);
      sectionErrors.invoice.push(notFutureResult.message);
    }
  }

  if (invoice.delivery_date) {
    const deliveryDateResult = Validations.validDate(invoice.delivery_date, 'Delivery date');
    if (!deliveryDateResult.valid) {
      showFieldError('delivery_date', deliveryDateResult.message);
      errors.push(deliveryDateResult.message);
      sectionErrors.invoice.push(deliveryDateResult.message);
    }
  }

  if (invoice.due_date) {
    const dueDateResult = Validations.validDate(invoice.due_date, 'Due date');
    if (!dueDateResult.valid) {
      showFieldError('due_date', dueDateResult.message);
      errors.push(dueDateResult.message);
      sectionErrors.invoice.push(dueDateResult.message);
    }
  }

  // Date order validation
  if (invoice.issue_date && invoice.delivery_date && invoice.due_date) {
    const dateOrderResult = Validations.invoiceDateOrder(
      invoice.issue_date,
      invoice.delivery_date,
      invoice.due_date
    );
    if (!dateOrderResult.valid) {
      // Show error on the date field that violates the rule
      const message = dateOrderResult.message;
      if (message.includes('Delivery date')) {
        showFieldError('delivery_date', message);
      } else if (message.includes('Due date')) {
        showFieldError('due_date', message);
      }
      errors.push(message);
      sectionErrors.invoice.push(message);
    }
  }

  // Due after issue validation
  if (invoice.issue_date && invoice.due_date) {
    const dueAfterIssueResult = Validations.dueAfterIssue(invoice.issue_date, invoice.due_date);
    if (!dueAfterIssueResult.valid) {
      showFieldError('due_date', dueAfterIssueResult.message);
      errors.push(dueAfterIssueResult.message);
      sectionErrors.invoice.push(dueAfterIssueResult.message);
    }
  }

  // IBAN validation
  if (invoice.iban) {
    const ibanResult = Validations.validIBAN(invoice.iban);
    if (!ibanResult.valid) {
      showFieldError('iban', ibanResult.message);
      errors.push(ibanResult.message);
      sectionErrors.payment.push(ibanResult.message);
    }
  }

  // Bank transfer requires IBAN
  const ibanRequiredResult = Validations.requiresIbanForBankTransfer(
    invoice.payment_method,
    invoice.iban
  );
  if (!ibanRequiredResult.valid) {
    showFieldError('iban', ibanRequiredResult.message);
    errors.push(ibanRequiredResult.message);
    sectionErrors.payment.push(ibanRequiredResult.message);
  }

  // Invoice totals validation (base + VAT = total)
  if (invoice.total_base != null && invoice.total_vat_amount != null && invoice.total_with_vat != null) {
    const totalsResult = Validations.invoiceTotals(
      invoice.total_base,
      invoice.total_vat_amount,
      invoice.total_with_vat
    );
    if (!totalsResult.valid) {
      showFieldError('total_with_vat', totalsResult.message);
      errors.push(totalsResult.message);
      sectionErrors.financial.push(totalsResult.message);
    }
  }

  // Line items sum validations
  if (invoice.items && invoice.items.length > 0) {
    const lineTotalsBaseResult = Validations.invoiceLineTotalsBase(invoice);
    if (!lineTotalsBaseResult.valid) {
      showFieldError('total_base', lineTotalsBaseResult.message);
      errors.push(lineTotalsBaseResult.message);
      sectionErrors.financial.push(lineTotalsBaseResult.message);
    }

    const lineTotalsVATResult = Validations.invoiceLineTotalsWithVAT(invoice);
    if (!lineTotalsVATResult.valid) {
      showFieldError('total_with_vat', lineTotalsVATResult.message);
      errors.push(lineTotalsVATResult.message);
      sectionErrors.financial.push(lineTotalsVATResult.message);
    }

    // Collect individual item errors
    invoice.items.forEach((item, index) => {
      const itemErrors = collectItemErrors(item, index);
      if (itemErrors.length > 0) {
        itemErrors.forEach(err => {
          errors.push(`Item ${index + 1}: ${err}`);
        });
      }
    });
  }

  // Display invoice-level errors (including item errors)
  displayInvoiceErrors(errors, sectionErrors);

  // Update accordion sections
  updateAccordionSections(sectionErrors);
}

/**
 * Update accordion section styling based on errors
 */
function updateAccordionSections(sectionErrors) {
  // Map section names to accordion IDs
  const sectionMap = {
    invoice: 'invoiceDetails',
    supplier: 'supplierInfo',
    buyer: 'buyerInfo',
    financial: 'financialInfo',
    payment: 'paymentInfo'
  };

  // Reset all accordion borders to blue
  Object.values(sectionMap).forEach(accordionId => {
    const accordion = document.getElementById(accordionId);
    if (accordion) {
      const parent = accordion.parentElement;
      if (parent) {
        parent.classList.remove('border-red-200');
        parent.classList.add('border-blue-200');

        const button = parent.querySelector('button');
        if (button) {
          button.classList.remove('from-red-50', 'to-white', 'hover:from-red-100', 'hover:to-red-50');
          button.classList.add('from-blue-50', 'to-white', 'hover:from-blue-100', 'hover:to-blue-50');
        }
      }
    }
  });

  // Apply red borders to sections with errors
  Object.keys(sectionErrors).forEach(section => {
    if (sectionErrors[section].length > 0) {
      const accordionId = sectionMap[section];
      if (accordionId) {
        const accordion = document.getElementById(accordionId);
        if (accordion) {
          const parent = accordion.parentElement;
          if (parent) {
            parent.classList.remove('border-blue-200');
            parent.classList.add('border-red-200');

            const button = parent.querySelector('button');
            if (button) {
              button.classList.remove('from-blue-50', 'to-white', 'hover:from-blue-100', 'hover:to-blue-50');
              button.classList.add('from-red-50', 'to-white', 'hover:from-red-100', 'hover:to-red-50');
            }
          }
        }
      }
    }
  });
}

/**
 * Display invoice-level validation errors
 */
function displayInvoiceErrors(errors, sectionErrors) {
  if (errors.length > 0) {
    console.group('📋 Validation Errors');
    console.log(`Total errors found: ${errors.length}`);
    console.log('');

    // Log all errors
    console.group('All Errors:');
    errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
    console.groupEnd();
    console.log('');

    // Log errors by section
    if (sectionErrors) {
      console.group('Errors by Section:');
      Object.keys(sectionErrors).forEach(section => {
        if (sectionErrors[section].length > 0) {
          console.group(`${section.toUpperCase()} (${sectionErrors[section].length} errors):`);
          sectionErrors[section].forEach((error, index) => {
            console.log(`${index + 1}. ${error}`);
          });
          console.groupEnd();
        }
      });
      console.groupEnd();
    }

    console.groupEnd();
  } else {
    console.log('✅ No validation errors found');
  }
}

/**
 * Collect item errors and display them
 */
function collectItemErrors(item, index) {
  // Check if Validations is available
  if (typeof Validations === 'undefined') {
    return [];
  }

  const errors = [];

  // Clear previous errors for this item
  clearItemErrors(index);

  // Validate quantity
  const qtyResult = Validations.quantity(item);
  if (!qtyResult.valid) {
    errors.push(qtyResult.message);
    showItemFieldError(index, 'quantity', qtyResult.message);
  }

  // Validate unit price
  const priceResult = Validations.unitPrice(item);
  if (!priceResult.valid) {
    errors.push(priceResult.message);
    showItemFieldError(index, 'unit_price', priceResult.message);
  }

  // Validate price times quantity
  const priceTimesQtyResult = Validations.priceTimesQty(item);
  if (!priceTimesQtyResult.valid) {
    errors.push(priceTimesQtyResult.message);
    showItemFieldError(index, 'line_total', priceTimesQtyResult.message);
  }

  // Validate invoice item calculations
  const invoiceItemResult = Validations.invoiceItem(item);
  if (!invoiceItemResult.valid) {
    errors.push(invoiceItemResult.message);
    showItemFieldError(index, 'line_total_with_vat', invoiceItemResult.message);
  }

  return errors;
}

/**
 * Show error message for an item field
 */
function showItemFieldError(index, field, message) {
  const container = document.querySelector("#invoiceItemsContainer");
  if (!container) return;

  const input = container.querySelector(`input[data-index="${index}"][data-field="${field}"]`);
  if (!input) return;

  // Add error styling to field
  input.classList.add('border-red-500');
  input.classList.remove('border-gray-300', 'border-blue-300');

  // Create error message element
  const errorId = `item-${index}-${field}-error`;
  const existingError = document.getElementById(errorId);
  if (existingError) existingError.remove();

  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error text-xs text-red-600 mt-1 break-words col-span-full';
  errorDiv.textContent = message;
  errorDiv.id = errorId;

  // Insert error after the field's parent container
  const parent = input.parentNode;
  if (parent && parent.classList.contains('flex')) {
    // Currency field with flex container
    parent.parentNode.insertBefore(errorDiv, parent.nextSibling);
  } else {
    // Regular field
    parent.insertBefore(errorDiv, input.nextSibling);
  }
}

/**
 * Clear all errors for a specific item
 */
function clearItemErrors(index) {
  const container = document.querySelector("#invoiceItemsContainer");
  if (!container) return;

  // Remove error styling from all inputs for this item
  const inputs = container.querySelectorAll(`input[data-index="${index}"]`);
  inputs.forEach(input => {
    input.classList.remove('border-red-500');
    input.classList.add('border-gray-300');
  });

  // Remove all error messages for this item
  const errors = container.querySelectorAll(`[id^="item-${index}-"][id$="-error"]`);
  errors.forEach(error => error.remove());
}

/**
 * Delete item handler
 */
function deleteItem(index) {
  if (!confirm(`Delete item ${index + 1}?`)) return;

  if (!currentData || !currentData.data || !currentData.data.items) return;

  // Remove item from data
  currentData.data.items.splice(index, 1);

  // Re-render items
  renderInvoiceItems(currentData.data.items);
  if (typeof markAsChanged === 'function') markAsChanged();

  // Validate after deletion
  if (currentData && currentData.classification && currentData.classification.type === 'INVOICE') {
    validateInvoiceData(currentData.data);
  }
}

/**
 * Update currency symbols throughout the form
 */
function updateCurrencySymbols(currency) {
  const currencyCode = currency || 'EUR';

  // Map currency codes to symbols
  const currencySymbols = {
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'CZK': 'Kč',
    'PLN': 'zł',
    'HUF': 'Ft',
    'CHF': 'CHF',
    'JPY': '¥',
    'CNY': '¥',
    'CAD': 'C$',
    'AUD': 'A$',
    'SEK': 'kr'
  };

  const symbol = currencySymbols[currencyCode] || currencyCode;

  // Update all currency symbols
  document.querySelectorAll('.currency-symbol').forEach(element => {
    element.textContent = symbol;
  });
}

/**
 * Update receipt item field value
 */
function updateReceiptItemField(index, field, value) {
  if (!currentData || !currentData.data || !currentData.data.items) return;

  const item = currentData.data.items[index];
  if (!item) return;

  // Parse numeric values
  if (['quantity', 'unit_price', 'vat_rate', 'line_total'].includes(field)) {
    item[field] = parseFloat(value) || 0;
  } else {
    item[field] = value;
  }

  // Auto-calculate line total
  if (['quantity', 'unit_price'].includes(field)) {
    item.line_total = round2((item.quantity || 0) * (item.unit_price || 0));
    // Update calculated field value in the DOM without re-rendering
    updateReceiptCalculatedFields(index, item);
  }
}

/**
 * Update receipt calculated field values in the DOM without re-rendering
 */
function updateReceiptCalculatedFields(index, item) {
  const container = document.querySelector("#receiptItemsContainer");
  if (!container) return;

  const inputs = container.querySelectorAll(`input[data-index="${index}"]`);
  inputs.forEach(input => {
    const field = input.dataset.field;
    if (field === 'line_total') {
      // Only update if not currently focused
      if (document.activeElement !== input) {
        input.value = (item[field] != null) ? item[field] : 0;
      }
    }
  });
}

/**
 * Add new receipt item
 */
function addNewReceiptItem() {
  if (!currentData || !currentData.data) return;

  if (!currentData.data.items) {
    currentData.data.items = [];
  }

  const newItem = {
    description: '',
    quantity: 1,
    unit: 'ks',
    unit_price: 0,
    vat_rate: 20,
    line_total: 0
  };

  currentData.data.items.push(newItem);
  renderReceiptItems(currentData.data.items);
  if (typeof markAsChanged === 'function') markAsChanged();
}

/**
 * Delete receipt item
 */
function deleteReceiptItem(index) {
  if (!confirm(`Delete item ${index + 1}?`)) return;

  if (!currentData || !currentData.data || !currentData.data.items) return;

  // Remove item from data
  currentData.data.items.splice(index, 1);

  // Re-render items
  renderReceiptItems(currentData.data.items);
  if (typeof markAsChanged === 'function') markAsChanged();
}
