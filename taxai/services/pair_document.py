
import frappe


def pair_invoice_with_bank_transaction(invoice_doctype, invoice_name, variable_symbol_field="variable_symbol"):
    """
    Generic function to pair any invoice type with bank transaction based on variable symbol and amount.
    Adds a payment record to the invoice and updates the bank transaction reference.
    
    Args:
        invoice_doctype (str): DocType name (e.g., "Sale Invoice", "Purchase Invoice")
        invoice_name (str): Name of the invoice document
        variable_symbol_field (str): Field name for variable symbol (default: "variable_symbol")
        
    Returns:
        dict: Result containing success status and paired transaction info
    """
    try:
        # Get the invoice
        invoice = frappe.get_doc(invoice_doctype, invoice_name)
        
        # Get variable symbol - try the specified field, fallback to external_number for Purchase Invoice
        variable_symbol = None
        if hasattr(invoice, variable_symbol_field) and getattr(invoice, variable_symbol_field):
            variable_symbol = getattr(invoice, variable_symbol_field)
        elif invoice_doctype == "Purchase Invoice" and hasattr(invoice, "external_number"):
            variable_symbol = invoice.external_number
        
        if not variable_symbol or not invoice.total:
            return {
                "success": False,
                "message": f"{invoice_doctype} must have both variable symbol and total amount"
            }
        
        # Find matching bank transaction
        bank_transactions = frappe.get_all(
            "Bank Transaction",
            filters={
                "vs": variable_symbol,
                "absolute_amount": invoice.total,
                "accounting_document": ["is", "not set"]  # Not already paired
            },
            fields=["name", "amount", "date", "opponent_name"]
        )
        
        if not bank_transactions:
            return {
                "success": False,
                "message": f"No matching bank transaction found for VS: {variable_symbol}, Amount: {invoice.total}"
            }
        
        if len(bank_transactions) > 1:
            return {
                "success": False,
                "message": f"Multiple bank transactions found for VS: {variable_symbol}, Amount: {invoice.total}. Manual review required."
            }
        
        # Get the matching bank transaction
        bank_transaction_data = bank_transactions[0]
        bank_transaction_name = bank_transaction_data["name"]
        bank_transaction = frappe.get_doc("Bank Transaction", bank_transaction_name)
        
        # Add payment record to invoice
        invoice.add_payment_record(
            payment_doctype="Bank Transaction",
            payment_doc=bank_transaction_name,
            amount=abs(bank_transaction_data["amount"]),
            date=bank_transaction_data["date"],
            payment_type="Bank"
        )
        
        # Update bank transaction with accounting document reference
        bank_transaction.accounting_document_type = invoice_doctype
        bank_transaction.accounting_document = invoice_name
        bank_transaction.save()
        
        return {
            "success": True,
            "message": f"Successfully paired {invoice_doctype} {invoice_name} with Bank Transaction {bank_transaction_name}",
            "invoice_type": invoice_doctype,
            "invoice_name": invoice_name,
            "bank_transaction": bank_transaction_name,
            "amount": abs(bank_transaction_data["amount"]),
            "variable_symbol": variable_symbol
        }
        
    except Exception as e:
        frappe.log_error(f"Error pairing {invoice_doctype} {invoice_name}: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }


def manual_pair_invoice_with_transaction(invoice_doctype, invoice_name, bank_transaction_name):
    """
    Manually pair an invoice with a specific bank transaction.
    Adds a payment record to the invoice regardless of amount matching.
    
    Args:
        invoice_doctype (str): DocType name (e.g., "Sale Invoice", "Purchase Invoice")
        invoice_name (str): Name of the invoice document
        bank_transaction_name (str): Name of the bank transaction
        
    Returns:
        dict: Result containing success status and paired transaction info
    """
    try:
        # Get the invoice and bank transaction
        invoice = frappe.get_doc(invoice_doctype, invoice_name)
        bank_transaction = frappe.get_doc("Bank Transaction", bank_transaction_name)
        
        # Check if this transaction is already paired with this invoice
        for record in invoice.payment_records:
            if record.payment_doc == bank_transaction_name:
                return {
                    "success": False,
                    "message": f"Bank Transaction {bank_transaction_name} is already paired with this invoice"
                }
        
        # If bank transaction is paired with another invoice, unpair it first
        if bank_transaction.accounting_document:
            unpair_bank_transaction(bank_transaction_name)
        
        # Add payment record to invoice
        invoice.add_payment_record(
            payment_doctype="Bank Transaction",
            payment_doc=bank_transaction_name,
            amount=abs(bank_transaction.amount),
            date=bank_transaction.date,
            payment_type="Bank"
        )
        
        # Update bank transaction with accounting document reference
        bank_transaction.accounting_document_type = invoice_doctype
        bank_transaction.accounting_document = invoice_name
        bank_transaction.save()
        
        return {
            "success": True,
            "message": f"Successfully paired {invoice_doctype} {invoice_name} with Bank Transaction {bank_transaction_name}",
            "invoice_type": invoice_doctype,
            "invoice_name": invoice_name,
            "bank_transaction": bank_transaction_name,
            "amount": abs(bank_transaction.amount)
        }
        
    except Exception as e:
        frappe.log_error(f"Error manually pairing {invoice_doctype} {invoice_name} with {bank_transaction_name}: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }


def pair_sale_invoice_with_bank_transaction(sale_invoice_name):
    """
    Pair sale invoice with bank transaction - wrapper for generic function.
    """
    return pair_invoice_with_bank_transaction("Sale Invoice", sale_invoice_name, "variable_symbol")


def pair_purchase_invoice_with_bank_transaction(purchase_invoice_name):
    """
    Pair purchase invoice with bank transaction using external_number as variable symbol.
    """
    return pair_invoice_with_bank_transaction("Purchase Invoice", purchase_invoice_name, "variable_symbol")


def auto_pair_all_unpaired_documents():
    """
    Automatically pair all unpaired invoices with matching bank transactions.
    Processes both Sale Invoices and Purchase Invoices.
    
    Returns:
        dict: Summary of pairing results
    """
    results = {
        "successful_pairs": [],
        "failed_pairs": [],
        "total_processed": 0,
        "total_successful": 0
    }
    
    try:
        # Get all unpaired sale invoices with variable symbol and total
        unpaired_sale_invoices = frappe.get_all(
            "Sale Invoice",
            filters={
                "variable_symbol": ["!=", ""],
                "total": [">", 0]
            },
            fields=["name", "variable_symbol", "total"]
        )
        
        # Get all unpaired purchase invoices with external_number and total
        unpaired_purchase_invoices = frappe.get_all(
            "Purchase Invoice",
            filters={
                "external_number": ["!=", ""],
                "total": [">", 0]
            },
            fields=["name", "external_number", "total"]
        )
        
        total_invoices = len(unpaired_sale_invoices) + len(unpaired_purchase_invoices)
        results["total_processed"] = total_invoices
        
        # Process sale invoices
        for invoice in unpaired_sale_invoices:
            result = pair_sale_invoice_with_bank_transaction(invoice["name"])
            
            if result["success"]:
                results["successful_pairs"].append(result)
                results["total_successful"] += 1
            else:
                results["failed_pairs"].append({
                    "invoice_type": "Sale Invoice",
                    "invoice": invoice["name"],
                    "error": result["message"]
                })
        
        # Process purchase invoices
        for invoice in unpaired_purchase_invoices:
            result = pair_purchase_invoice_with_bank_transaction(invoice["name"])
            
            if result["success"]:
                results["successful_pairs"].append(result)
                results["total_successful"] += 1
            else:
                results["failed_pairs"].append({
                    "invoice_type": "Purchase Invoice",
                    "invoice": invoice["name"],
                    "error": result["message"]
                })
        
        return results
        
    except Exception as e:
        frappe.log_error(f"Error in auto_pair_all_unpaired_documents: {str(e)}")
        return {
            "error": str(e),
            "successful_pairs": results.get("successful_pairs", []),
            "failed_pairs": results.get("failed_pairs", []),
            "total_processed": results.get("total_processed", 0),
            "total_successful": results.get("total_successful", 0)
        }


def unpair_documents(sale_invoice_name=None, purchase_invoice_name=None, bank_transaction_name=None):
    """
    Remove pairing between invoices and bank transactions.
    Removes payment records from invoices and clears bank transaction references.
    
    Args:
        sale_invoice_name (str, optional): Name of Sale Invoice to unpair
        purchase_invoice_name (str, optional): Name of Purchase Invoice to unpair
        bank_transaction_name (str, optional): Name of Bank Transaction to unpair
        
    Returns:
        dict: Result of unpairing operation
    """
    try:
        updated_docs = []
        
        # Handle sale invoice unpairing (remove specific payment record)
        if sale_invoice_name and bank_transaction_name:
            sale_invoice = frappe.get_doc("Sale Invoice", sale_invoice_name)
            sale_invoice.remove_payment_record(bank_transaction_name)
            updated_docs.append(f"Sale Invoice {sale_invoice_name}")
        
        # Handle purchase invoice unpairing (remove specific payment record)
        if purchase_invoice_name and bank_transaction_name:
            purchase_invoice = frappe.get_doc("Purchase Invoice", purchase_invoice_name)
            purchase_invoice.remove_payment_record(bank_transaction_name)
            updated_docs.append(f"Purchase Invoice {purchase_invoice_name}")
        
        # Handle bank transaction unpairing
        if bank_transaction_name:
            unpair_bank_transaction(bank_transaction_name)
            if f"Bank Transaction {bank_transaction_name}" not in updated_docs:
                updated_docs.append(f"Bank Transaction {bank_transaction_name}")
        
        return {
            "success": True,
            "message": f"Successfully unpaired documents: {', '.join(updated_docs)}",
            "updated_documents": updated_docs
        }
        
    except Exception as e:
        frappe.log_error(f"Error unpairing documents: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }


def unpair_bank_transaction(bank_transaction_name):
    """
    Unpair a bank transaction from its linked invoice.
    Removes the payment record from the invoice and clears transaction reference.
    
    Args:
        bank_transaction_name (str): Name of Bank Transaction to unpair
    """
    try:
        bank_transaction = frappe.get_doc("Bank Transaction", bank_transaction_name)
        paired_invoice = bank_transaction.accounting_document
        paired_invoice_type = bank_transaction.accounting_document_type
        
        # Clear accounting document fields
        bank_transaction.accounting_document_type = None
        bank_transaction.accounting_document = None
        bank_transaction.save()
        
        # If there was a paired invoice, remove the payment record
        if paired_invoice and paired_invoice_type:
            try:
                invoice = frappe.get_doc(paired_invoice_type, paired_invoice)
                invoice.remove_payment_record(bank_transaction_name)
            except:
                pass  # Invoice might not exist anymore
                
    except Exception as e:
        frappe.log_error(f"Error unpairing bank transaction {bank_transaction_name}: {str(e)}")
        raise


def pair_sale_invoice(invoice_number):
    """Legacy function - redirect to new function"""
    # print("Test")
    return pair_sale_invoice_with_bank_transaction(invoice_number)
    
    
    
    