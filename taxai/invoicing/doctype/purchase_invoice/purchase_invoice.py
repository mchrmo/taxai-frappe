# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document

class PurchaseInvoice(Document):
  def after_insert(self):
    series = frappe.get_doc("Naming Series", self.doctype)  
    series.increment_series()
    
    self.calculate_taxes()
    
    frappe.enqueue(
      self.pair_with_bank_transaction,
      queue='default',
      timeout=300
    )
    # self.pair_with_bank_transaction()
    self.save()

  def on_trash(self):
    
    self.unpair_payment_document()
    # Unpair Incoming Document if linked
    try:
      document = frappe.get_doc("Incoming Document", {"created_document": self.name})
      if document:
        document.created_document = None
        document.save()
    except frappe.DoesNotExistError:
      pass



  def calculate_taxes(self):
    """Calculate taxes for the purchase invoice based on its items"""
    # Clear existing taxes
    self.taxes = []
    
    # Group items by VAT rate
    items_by_tax = {}
    
    for item in self.items:
      vat_rate = item.vat_rate
      if vat_rate not in items_by_tax:
        items_by_tax[vat_rate] = 0
      items_by_tax[vat_rate] += item.total
    
    # Calculate taxes for each rate
    total_tax = 0
    for rate, base in items_by_tax.items():
      vat = base * (rate / 100)
      total_tax += vat
      
      self.append('taxes', {
        'base': base,
        'rate': rate,
        'vat': vat,
        'total': base + vat
      })
    
    # Set total VAT amount
    self.vat = total_tax

  def find_matching_bank_transaction(self):
    """Find bank transaction that matches this purchase invoice's external number and total amount"""
    if not self.external_number or not self.total:
      return None
    
    bank_transactions = frappe.get_all(
      "Bank Transaction",
      filters={
        "vs": self.external_number,
        "absolute_amount": self.total,
        "accounting_document": ["is", "not set"]
      },
      fields=["name", "amount", "date", "opponent_name"]
    )
    
    return bank_transactions[0]["name"] if len(bank_transactions) == 1 else None
  
  def pair_with_bank_transaction(self):
    """Automatically pair this purchase invoice with matching bank transaction"""
    from taxai.services.pair_document import pair_purchase_invoice_with_bank_transaction
    return pair_purchase_invoice_with_bank_transaction(self.name)
  
  def unpair_payment_document(self):
    """Remove pairing with payment document"""
    from taxai.services.pair_document import unpair_documents
    return unpair_documents(purchase_invoice_name=self.name)
  
  def is_paid(self):
    """Check if this invoice has been paid (has a linked payment document)"""
    return bool(self.payment_document and self.payment_document_type)
