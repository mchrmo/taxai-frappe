# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class PurchaseInvoice(Document):
  def after_insert(self):
    series = frappe.get_doc("Naming Series", self.doctype)  
    series.increment_series()


