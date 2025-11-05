# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class BankTransaction(Document):
  
  def before_save(self):
    self.absolute_amount = abs(self.amount)


  def pair_accounting_document(self, doctype, docname):
    self.accounting_document_type = doctype
    self.accounting_document = docname
    self.save()
    print("Paired with", doctype, docname)
