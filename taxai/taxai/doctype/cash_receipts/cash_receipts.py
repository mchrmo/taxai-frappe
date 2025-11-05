# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class CashReceipts(Document):
  
  def after_insert(self):
    series = frappe.get_doc("Naming Series", self.doctype)  
    series.increment_series()
    
  def pair_payment(self):
      bank_transactions = frappe.db.get_list(
        "Bank Transaction", 
        filters=[
          {'amount': self.total},
        ]                                  
      )
  
      if len(bank_transactions) != 1:
        print("No unique match found")
        frappe.throw('No unique match found')

      transaction = frappe.get_doc("Bank Transaction", bank_transactions[0].name)
      self.bank_payment = transaction.name
      self.save()

      transaction.pair_accounting_document("CashReceipts", self.name)
      
      print("Paired with bank transaction", self.bank_payment)  
      return {"status": "success", "bank_transaction": self.bank_payment}
    
    
@frappe.whitelist()
def pair_payment(cash_receipts_name):
  cash_receipts = frappe.get_doc("CashReceipts", cash_receipts_name)
  res = cash_receipts.pair_payment()
  return res
