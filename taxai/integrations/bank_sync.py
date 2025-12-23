import frappe
import requests
from datetime import datetime

@frappe.whitelist()
def sync_bank_transactions(bank_account_name, from_date=datetime.now(), to_date=datetime.now()):
    
    bank_account = frappe.get_doc("Bank Account", bank_account_name)
    
    # Parse from_date if it's a string
    if isinstance(from_date, str):
      from_date = datetime.strptime(from_date, "%Y-%m-%d").strftime("%Y-%m-%d")
    else:
      from_date = from_date.strftime("%Y-%m-%d")

    # Parse to_date if it's a string  
    if isinstance(to_date, str):
      to_date = datetime.strptime(to_date, "%Y-%m-%d").strftime("%Y-%m-%d")
    else:
      to_date = to_date.strftime("%Y-%m-%d")
    
    if not bank_account:
      frappe.throw("Bank Account not found")
    
    if not bank_account.allow_integration:
      frappe.throw("Bank Integration is not allowed for this Bank Account")
    
    if not bank_account.access_token:
      frappe.throw("Bank Account is not connected to any bank")
    
    if bank_account.bank != "Fio Banka SK":
      frappe.throw("Currently only Fio Banka SK is supported")
      
    
    # Construct the API URL
    api_url = f"https://fioapi.fio.cz/v1/rest/periods/{bank_account.access_token}/{from_date}/{to_date}/transactions.json"

    # Make GET request
    response = requests.get(api_url)

    # Check if request was successful
    if response.status_code == 200:
      account_statement_res = response.json()
      account_statement = account_statement_res.get('accountStatement', {})
      
      for transaction in account_statement['transactionList'].get('transaction', []):
          transaction_data = {
              "id": _fio_get_value(transaction, 22),
              "type": _fio_get_value(transaction, 8),
              "date": _fio_get_value(transaction, 0),
              "amount": _fio_get_value(transaction, 1),
              "currency": _fio_get_value(transaction, 14),
              "comment": _fio_get_value(transaction, 25),
              "vs": _fio_get_value(transaction, 5),
              "ss": _fio_get_value(transaction, 6),
              "ks": _fio_get_value(transaction, 4),
              "opponent_name": _fio_get_value(transaction, 10),
              "opponent_account": _fio_get_value(transaction, 2),
              "reference": _fio_get_value(transaction, 16),
          }
          
          if not transaction_data['comment']:
              transaction_data['comment'] = _fio_get_value(transaction, 16)
              
          _create_bank_transaction(bank_account_name, transaction_data)

      return account_statement['info']
    else:
      frappe.throw(f"Failed to fetch transactions: {response.status_code} - {response.text}")
      
def _create_bank_transaction(bank_account_name, transaction_data):

    # Check if transaction already exists
    existing_transaction = frappe.get_all("Bank Transaction", filters={"transaction_id": transaction_data['id']})
    if existing_transaction:
        return  # Skip if transaction already exists

    # Parse date properly
    date_str = transaction_data.get('date')
    if date_str:
        # Handle date string with timezone (e.g., "2025-10-11+0200")
        if '+' in date_str:
            date_str = date_str.split('+')[0]  # Remove timezone part
        elif '-' in date_str and len(date_str) > 10:
            # Handle negative timezone (e.g., "2025-10-11-0500")
            parts = date_str.split('-')
            if len(parts) > 3:  # More than just YYYY-MM-DD
                date_str = '-'.join(parts[:3])  # Keep only YYYY-MM-DD
        transaction_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        transaction_date = datetime.now().date()

    # Create new Bank Transaction
    bank_transaction = frappe.get_doc({
      "doctype": "Bank Transaction",
      "transaction_id": transaction_data['id'],
      "type": transaction_data.get('type', 'Unknown'),
      "date": transaction_date,
      "amount": transaction_data.get('amount', 0.0),
      "currency": transaction_data.get('currency', 'EUR'),
      "comment": transaction_data.get('comment', ''),
      "bank_account": bank_account_name,
      "vs": transaction_data.get('vs', None),
      "ss": transaction_data.get('ss', None),
      "ks": transaction_data.get('ks', None),
      "opponent_name": transaction_data.get('opponent_name', ''),
      "opponent_account": transaction_data.get('opponent_account', ''),
      "reference": transaction_data.get('reference', ''),
        })
    bank_transaction.insert()
    
def _fio_get_value(transaction, column_id):
    col = transaction.get(f'column{column_id}', None)
    if not col:
        return None
    return col.get('value', None)