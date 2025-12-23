"""
API methods for document pairing functionality

These methods can be called via Frappe's REST API or from the frontend.
Pairing works only from the invoice side (Sale Invoice or Purchase Invoice).
"""

import frappe
from frappe import _
from taxai.services.pair_document import (
    pair_sale_invoice_with_bank_transaction,
    pair_purchase_invoice_with_bank_transaction,
    auto_pair_all_unpaired_documents,
    unpair_documents
)


@frappe.whitelist()
def pair_invoice_with_transaction(invoice_name, invoice_type="Sale Invoice"):
    """
    API method to pair an invoice with matching bank transaction
    
    Args:
        invoice_name (str): Name of the Invoice
        invoice_type (str): Type of invoice ("Sale Invoice" or "Purchase Invoice")
        
    Returns:
        dict: Pairing result
    """
    if not frappe.has_permission(invoice_type, "write", invoice_name):
        frappe.throw(_(f"Not permitted to modify this {invoice_type}"))
    
    if invoice_type == "Sale Invoice":
        return pair_sale_invoice_with_bank_transaction(invoice_name)
    elif invoice_type == "Purchase Invoice":
        return pair_purchase_invoice_with_bank_transaction(invoice_name)
    else:
        frappe.throw(_("Invalid invoice type. Must be 'Sale Invoice' or 'Purchase Invoice'"))


@frappe.whitelist()
def manual_pair_invoice_with_transaction(invoice_name, invoice_type, bank_transaction_name):
    """
    API method to manually pair an invoice with a specific bank transaction
    Adds a payment record to the invoice
    
    Args:
        invoice_name (str): Name of the Invoice
        invoice_type (str): Type of invoice ("Sale Invoice" or "Purchase Invoice")
        bank_transaction_name (str): Name of the Bank Transaction to pair with
        
    Returns:
        dict: Pairing result
    """
    if not frappe.has_permission(invoice_type, "write", invoice_name):
        frappe.throw(_(f"Not permitted to modify this {invoice_type}"))
        
    if not frappe.has_permission("Bank Transaction", "write", bank_transaction_name):
        frappe.throw(_("Not permitted to modify this Bank Transaction"))
    
    try:
        from taxai.services.pair_document import manual_pair_invoice_with_transaction
        return manual_pair_invoice_with_transaction(invoice_type, invoice_name, bank_transaction_name)
        
    except Exception as e:
        frappe.log_error(f"Error manually pairing {invoice_type} {invoice_name} with {bank_transaction_name}: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }


@frappe.whitelist()
def auto_pair_documents():
    """
    API method to automatically pair all unpaired documents
    
    Returns:
        dict: Summary of pairing results
    """
    # Check permissions for both invoice types and bank transactions
    required_permissions = ["Bank Transaction", "Sale Invoice", "Purchase Invoice"]
    for doctype in required_permissions:
        if not frappe.has_permission(doctype, "write"):
            frappe.throw(_(f"Not permitted to modify {doctype} documents"))
    
    return auto_pair_all_unpaired_documents()


@frappe.whitelist()
def unpair_invoice_and_transaction(sale_invoice_name=None, purchase_invoice_name=None, bank_transaction_name=None):
    """
    API method to unpair documents
    Removes payment record from invoice and clears bank transaction reference
    
    Args:
        sale_invoice_name (str, optional): Name of Sale Invoice
        purchase_invoice_name (str, optional): Name of Purchase Invoice
        bank_transaction_name (str, optional): Name of Bank Transaction
        
    Returns:
        dict: Unpairing result
    """
    if sale_invoice_name and not frappe.has_permission("Sale Invoice", "write", sale_invoice_name):
        frappe.throw(_("Not permitted to modify this Sale Invoice"))
        
    if purchase_invoice_name and not frappe.has_permission("Purchase Invoice", "write", purchase_invoice_name):
        frappe.throw(_("Not permitted to modify this Purchase Invoice"))
        
    if bank_transaction_name and not frappe.has_permission("Bank Transaction", "write", bank_transaction_name):
        frappe.throw(_("Not permitted to modify this Bank Transaction"))
    
    return unpair_documents(
        sale_invoice_name=sale_invoice_name, 
        purchase_invoice_name=purchase_invoice_name,
        bank_transaction_name=bank_transaction_name
    )


@frappe.whitelist()
def get_pairing_candidates(document_type, document_name):
    """
    Get potential pairing candidates for an invoice
    
    Args:
        document_type (str): "Sale Invoice" or "Purchase Invoice"
        document_name (str): Name of the invoice
        
    Returns:
        list: List of potential Bank Transaction matches
    """
    if document_type == "Sale Invoice":
        doc = frappe.get_doc("Sale Invoice", document_name)
        if not doc.variable_symbol or not doc.total:
            return []
        variable_symbol = doc.variable_symbol
        
    elif document_type == "Purchase Invoice":
        doc = frappe.get_doc("Purchase Invoice", document_name)
        if not doc.external_number or not doc.total:
            return []
        variable_symbol = doc.variable_symbol
        
    else:
        frappe.throw(_("Pairing candidates only available for Sale Invoice or Purchase Invoice"))
        
    candidates = frappe.get_all(
        "Bank Transaction",
        filters={
            "vs": variable_symbol,
            "absolute_amount": doc.total
        },
        fields=["name", "date", "amount", "opponent_name", "accounting_document"]
    )
    
    print(variable_symbol)
    if(len(candidates) == 1):
      return candidates
      
    return frappe.get_all(
        "Bank Transaction",
        filters={
            "vs": variable_symbol
        },
        fields=["name", "date", "amount", "opponent_name", "accounting_document"]
    )


@frappe.whitelist()
def get_unpaired_invoices_for_transaction(doctype, txt, searchfield, start, page_len, filters):
    """
    Get list of unpaired invoices for pairing with a bank transaction.
    Used as a query method for Link field in Bank Transaction form.
    
    Args:
        doctype (str): The invoice doctype to search
        txt (str): Search text entered by user
        searchfield (str): Field to search on
        start (int): Pagination start
        page_len (int): Page length
        filters (dict): Additional filters including invoice_type and transaction_amount
        
    Returns:
        list: List of tuples with invoice names and display values
    """
    invoice_type = filters.get("invoice_type", "Sale Invoice")
    transaction_amount = filters.get("transaction_amount", 0)
    
    # Base conditions
    conditions = []
    values = {"txt": f"%{txt}%"}
    
    if invoice_type == "Sale Invoice":
        conditions.append("variable_symbol LIKE %(txt)s OR customer LIKE %(txt)s OR internal_number LIKE %(txt)s")
        name_field = "internal_number"
        partner_field = "customer"
    else:  # Purchase Invoice
        conditions.append("external_number LIKE %(txt)s OR supplier LIKE %(txt)s OR internal_number LIKE %(txt)s")
        name_field = "internal_number"
        partner_field = "supplier"
    
    # Filter to show invoices with unpaid amount
    conditions.append("(unpaid_amount IS NULL OR unpaid_amount > 0)")
    
    where_clause = " AND ".join(conditions)
    
    query = f"""
        SELECT 
            name,
            {name_field} as invoice_number,
            {partner_field} as partner,
            total,
            unpaid_amount,
            issued_date
        FROM `tab{invoice_type}`
        WHERE {where_clause}
        ORDER BY 
            CASE WHEN ABS(total - %(transaction_amount)s) < 0.01 THEN 0 ELSE 1 END,
            issued_date DESC
        LIMIT %(start)s, %(page_len)s
    """
    
    values["transaction_amount"] = transaction_amount
    values["start"] = start
    values["page_len"] = page_len
    
    results = frappe.db.sql(query, values, as_dict=True)
    
    # Format results as required by Link field query
    return [
        (
            r.name,
            f"{r.invoice_number} - {r.partner} - {frappe.format(r.total, {'fieldtype': 'Currency'})} - Unpaid: {frappe.format(r.unpaid_amount or r.total, {'fieldtype': 'Currency'})}"
        )
        for r in results
    ]


@frappe.whitelist()
def get_unpaired_documents_summary():
    """
    Get summary of unpaired documents
    
    Returns:
        dict: Summary of unpaired Sale Invoices, Purchase Invoices, and Bank Transactions
    """
    unpaired_sale_invoices = frappe.get_all(
        "Sale Invoice",
        filters={
            "variable_symbol": ["!=", ""],
            "total": [">", 0]
        },
        fields=["name", "variable_symbol", "total", "issued_date", "customer", "unpaid_amount"]
    )
    
    # Filter to only include invoices with unpaid amounts
    unpaired_sale_invoices = [inv for inv in unpaired_sale_invoices if inv.get("unpaid_amount", inv["total"]) > 0]
    
    unpaired_purchase_invoices = frappe.get_all(
        "Purchase Invoice",
        filters={
            "external_number": ["!=", ""],
            "total": [">", 0]
        },
        fields=["name", "external_number", "total", "issued_date", "supplier", "unpaid_amount"]
    )
    
    # Filter to only include invoices with unpaid amounts
    unpaired_purchase_invoices = [inv for inv in unpaired_purchase_invoices if inv.get("unpaid_amount", inv["total"]) > 0]
    
    unpaired_transactions = frappe.get_all(
        "Bank Transaction",
        filters={
            "accounting_document": ["is", "not set"],
            "vs": ["!=", ""],
            "absolute_amount": [">", 0]
        },
        fields=["name", "vs", "absolute_amount", "date", "opponent_name"]
    )
    
    return {
        "unpaired_sale_invoices": unpaired_sale_invoices,
        "unpaired_purchase_invoices": unpaired_purchase_invoices,
        "unpaired_transactions": unpaired_transactions,
        "total_unpaired_sale_invoices": len(unpaired_sale_invoices),
        "total_unpaired_purchase_invoices": len(unpaired_purchase_invoices),
        "total_unpaired_transactions": len(unpaired_transactions),
        "total_unpaired_invoices": len(unpaired_sale_invoices) + len(unpaired_purchase_invoices)
    }