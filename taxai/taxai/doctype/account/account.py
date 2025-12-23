# Copyright (c) 2025, Michal Chrmo and contributors
# For license information, please see license.txt

# import frappe
from frappe.model.document import Document


class Account(Document):
	

  def before_insert(self):
    if len(self.account_number) < 3:
      self.account_number = self.account_number.zfill(3)
  
    if not self.account_class:
      # set class as from first digit of account number
      self.account_class = self.account_number[0]
    
        