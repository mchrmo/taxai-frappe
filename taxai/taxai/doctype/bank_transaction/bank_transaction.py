# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class BankTransaction(Document):
  
  def before_save(self):
    self.absolute_amount = abs(self.amount)

  def is_paired(self):
    """Check if this transaction is paired with an accounting document"""
    return bool(self.accounting_document and self.accounting_document_type)

  def pair_accounting_document(self, doctype, docname):
    """Legacy method - pairs this transaction with an accounting document"""
    self.accounting_document_type = doctype
    self.accounting_document = docname
    self.save()
    print("Paired with", doctype, docname)
