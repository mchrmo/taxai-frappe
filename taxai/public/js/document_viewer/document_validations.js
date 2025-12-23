// validations.js


// ==================================================
// Validation functions
// ==================================================
const Validations = {
  // ----------------------------------------------
  // GENERAL VALIDATIONS
  // ----------------------------------------------

  requiredFields(obj, requiredFields) {
    const missing = requiredFields.filter(
      (f) => obj[f] == null || obj[f] === ""
    );
    if (missing.length)
      return {
        valid: false,
        message: `Please fill in the following required fields: ${missing.map(f => f.replace(/_/g, ' ')).join(", ")}`,
      };
    return { valid: true };
  },

  numbersParseCorrectly(obj, fields) {
    for (const f of fields) {
      if (obj[f] != null && isNaN(Number(obj[f]))) {
        return { valid: false, message: `"${f.replace(/_/g, ' ')}" must be a valid number` };
      }
    }
    return { valid: true };
  },

  validDate(str, fieldName) {
    const d = parseDate(str);
    if (!d) return { valid: false, message: `${fieldName} is not a valid date (expected format: YYYY-MM-DD)` };
    return { valid: true };
  },

  validIBAN(iban) {
    if (!iban) return { valid: false, message: "IBAN is required" };

    const cleaned = iban.replace(/\s+/g, "").toUpperCase();
    if (!/^[A-Z0-9]+$/.test(cleaned)) {
      return { valid: false, message: "IBAN contains invalid characters (only letters and numbers allowed)" };
    }

    const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
    const converted = rearranged.replace(/[A-Z]/g, (ch) => ch.charCodeAt(0) - 55);
    const mod = BigInt(converted) % 97n;

    return mod === 1n
      ? { valid: true }
      : { valid: false, message: "IBAN is invalid - please check the account number" };
  },

  // ----------------------------------------------
  // DATE VALIDATIONS
  // ----------------------------------------------

  invoiceDateOrder(issue, delivery, due) {
    const i = parseDate(issue);
    const d = parseDate(delivery);
    const u = parseDate(due);

    if (!i || !d || !u)
      return { valid: false, message: "One or more dates are invalid" };

    if (i > d)
      return { valid: false, message: "Delivery date must be on or after the issue date" };

    if (d > u)
      return { valid: false, message: "Due date must be on or after the delivery date" };

    return { valid: true };
  },

  notFuture(dateStr, fieldName = "Date") {
    const d = parseDate(dateStr);
    if (!d) return { valid: false, message: `${fieldName} invalid` };

    const now = new Date();
    if (d > now)
      return { valid: false, message: `${fieldName} cannot be in the future` };

    return { valid: true };
  },

  dueAfterIssue(issue, due) {
    const i = parseDate(issue);
    const u = parseDate(due);

    if (i > u)
      return { valid: false, message: "Due date must be on or after the issue date" };

    return { valid: true };
  },

  // ----------------------------------------------
  // SUM VALIDATIONS
  // ----------------------------------------------

  sumMatches(totalDeclared, items, field = "line_total") {
    totalDeclared = round2(totalDeclared)
    const sum = items.reduce((acc, it) => acc + Number(it[field] || 0), 0);
    if (round2(sum) !== totalDeclared) {
      const fieldName = field.replace(/_/g, ' ');
      return {
        valid: false,
        message: `Sum of item ${fieldName}s (${round2(sum)}) ≠ total (${totalDeclared})`,
      };
    }
    return { valid: true };
  },

  requiresIbanForBankTransfer(paymentMethod, iban) {
    if (paymentMethod === "BANK_TRANSFER" && !iban) {
      return {
        valid: false,
        message: "IBAN is required for bank transfer payments",
      };
    }
    return { valid: true };
  },

  // ----------------------------------------------
  // INVOICE VALIDATIONS
  // ----------------------------------------------

  invoiceTotals(base, vatAmount, total) {
    const calc = round2(Number(base) + Number(vatAmount));
    if (calc !== round2(total)) {
      return {
        valid: false,
        message: `Total (${total}) should be ${base} + ${vatAmount} = ${calc}`,
      };
    }
    return { valid: true };
  },

  invoiceLineTotalsBase(invoice) {
    return Validations.sumMatches(invoice.total_base, invoice.items, "line_total");
  },

  invoiceLineTotalsWithVAT(invoice) {
    return Validations.sumMatches(
      invoice.total_with_vat,
      invoice.items,
      "line_total_with_vat"
    );
  },

  invoiceItem(item) {
    
    const calcTotal = round2(item.unit_price * item.quantity);
    item.unit_price_with_vat = round2(item.unit_price * (1 + item.vat_rate / 100));
    const calcTotalVat = round2(item.unit_price_with_vat * item.quantity);
    const calcVatAmount = round2(calcTotalVat - calcTotal);

    if (round2(item.line_total) !== calcTotal)
      return { valid: false, message: `Line total (${item.line_total}) should be ${calcTotal} (unit price × quantity)` };

    if (round2(item.line_total_with_vat) !== calcTotalVat)
      return { valid: false, message: `Line total with VAT (${item.line_total_with_vat}) should be ${calcTotalVat}` };

    if (round2(item.vat_amount) !== calcVatAmount)
      return { valid: false, message: `VAT amount (${item.vat_amount}) should be ${calcVatAmount}` };

    return { valid: true };
  },

  // ----------------------------------------------
  // RECEIPT VALIDATIONS
  // ----------------------------------------------

  receiptTotals(subtotal, rounding, total) {
    const calc = round2(Number(subtotal) + Number(rounding));
    if (calc !== round2(total)) {
      return {
        valid: false,
        message: `Total (${total}) should equal Subtotal (${subtotal}) + Rounding (${rounding}) = ${calc}`,
      };
    }
    return { valid: true };
  },

  receiptVatTotals(vatBase, vatAmount, total) {
    const calc = round2(vatBase + vatAmount);
    if (calc !== round2(total)) {
      return {
        valid: false,
        message: `Total (${total}) should equal VAT Base (${vatBase}) + VAT Amount (${vatAmount}) = ${calc}`,
      };
    }
    return { valid: true };
  },

  receiptItemTotals(receipt) {
    return Validations.sumMatches(receipt.subtotal, receipt.items, "line_total");
  },

  itemVatRate(item) {
    const expected = round2((item.line_total * item.vat_rate) / 100);
    if (round2(item.vat_amount) !== expected) {
      return {
        valid: false,
        message: `VAT amount for "${item.description}" should be ${expected} (${item.vat_rate}% of ${item.line_total})`,
      };
    }
    return { valid: true };
  },

  // ----------------------------------------------
  // DUPLICATE DETECTION
  // ----------------------------------------------

  duplicateInvoice(existingDocs, newDoc) {
    const duplicate = existingDocs.find(
      (d) =>
        d.supplier_ico === newDoc.supplier_ico &&
        d.invoice_number === newDoc.invoice_number
    );

    return duplicate
      ? {
          valid: false,
          message: "This invoice number already exists for this supplier",
        }
      : { valid: true };
  },

  likelyDuplicate(existingDocs, newDoc) {
    const match = existingDocs.find(
      (d) =>
        d.supplier_ico === newDoc.supplier_ico &&
        round2(d.total_with_vat) === round2(newDoc.total_with_vat) &&
        d.issue_date === newDoc.issue_date
    );

    return match
      ? { valid: false, message: "Warning: A document with the same supplier, date, and total amount already exists" }
      : { valid: true };
  },

  // ----------------------------------------------
  // LINE ITEM VALIDATIONS
  // ----------------------------------------------

  quantity(item) {
    if (item.quantity <= 0)
      return { valid: false, message: "Quantity must be greater than 0" };
    return { valid: true };
  },

  unitPrice(item) {
    if (item.unit_price < 0)
      return { valid: false, message: "Unit price cannot be negative" };
    return { valid: true };
  },

  priceTimesQty(item) {
    const expected = round2(item.unit_price * item.quantity);
    if (round2(item.line_total) !== expected) {
      return {
        valid: false,
        message: `Line total should be ${expected} (${item.unit_price} × ${item.quantity})`,
      };
    }
    return { valid: true };
  },
};


// ==================================================
// Utility helpers
// ==================================================
const round2 = (num) =>
  Math.round((Number(num) + Number.EPSILON) * 100) / 100;

const parseDate = (str) => {
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
};


