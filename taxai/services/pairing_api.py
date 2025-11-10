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
    Bypasses automatic condition checks - for manual user selection only
    
    Args:
        invoice_name (str): Name of the Invoice
        invoice_type (str): Type of invoice ("Sale Invoice" or "Purchase Invoice")
        bank_transaction_name (str): Name of the Bank Transaction to pair with
        
    Returns:
        dict: Pairing result
    """
    # if not frappe.has_permission(invoice_type, "write", invoice_name):
    #     frappe.throw(_(f"Not permitted to modify this {invoice_type}"))
        
    if not frappe.has_permission("Bank Transaction", "write", bank_transaction_name):
        frappe.throw(_("Not permitted to modify this Bank Transaction"))
    
    try:
        # Get the invoice and bank transaction
        invoice = frappe.get_doc(invoice_type, invoice_name)
        bank_transaction = frappe.get_doc("Bank Transaction", bank_transaction_name)
        
        # Update invoice with payment document reference
        invoice.payment_document_type = "Bank Transaction"
        invoice.payment_document = bank_transaction_name
        invoice.save()
        
        # Update bank transaction with accounting document reference
        bank_transaction.accounting_document_type = invoice_type
        bank_transaction.accounting_document = invoice_name
        bank_transaction.save()
        
        return {
            "success": True,
            "message": f"Successfully paired {invoice_type} {invoice_name} with Bank Transaction {bank_transaction_name}",
            "invoice_type": invoice_type,
            "invoice_name": invoice_name,
            "bank_transaction": bank_transaction_name
        }
        
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
        variable_symbol = doc.external_number
        
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
def get_unpaired_documents_summary():
    """
    Get summary of unpaired documents
    
    Returns:
        dict: Summary of unpaired Sale Invoices, Purchase Invoices, and Bank Transactions
    """
    unpaired_sale_invoices = frappe.get_all(
        "Sale Invoice",
        filters={
            "payment_document": ["is", "not set"],
            "variable_symbol": ["!=", ""],
            "total": [">", 0]
        },
        fields=["name", "variable_symbol", "total", "issued_date", "customer"]
    )
    
    unpaired_purchase_invoices = frappe.get_all(
        "Purchase Invoice",
        filters={
            "payment_document": ["is", "not set"],
            "external_number": ["!=", ""],
            "total": [">", 0]
        },
        fields=["name", "external_number", "total", "issued_date", "supplier"]
    )
    
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