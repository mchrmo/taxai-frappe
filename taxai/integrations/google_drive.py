# your_app/integrations/gdrive_sa.py
import json, io, time
import frappe
from typing import Dict, List, Optional
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.service_account import Credentials
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

jsonkey = {
  "type": "service_account",
  "project_id": "taxai-473614",
  "private_key_id": "22a9902601e010f3460ddee9b822ad739cb725fa",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDyP1ic0kgeob0t\nV8bwstSRuPajt2x6VuXhE+Y4UgWP8Vc1pN/ih+ebzYhYwoL7c2dQgMAOhOJkOogr\neDmVdM1BoJxZZBas14KY1Z3ur05DuA4xbroEKTVGvx2O+7RPmFQRskbk6uClx52M\nXcF+JNYACnIPmQgYWT89wpyGrGb593ypPDN3BJrRWbkiT6UfGuRJySlAslJ6iCJ9\n/k57un2udAarvaVxm3Mh1S8lDuLk8YSx8wq2aMJA+dQeNT1r7b4MIGebh9+Zqk7a\nD/vGJmI6mdPf8BgqIulC2evymb6DSIg7LN4I+MeezfWejYN5jhJf5kyMa60buNGo\nesAKJrvJAgMBAAECggEAKKf3AELOdc2hSVXc/pKU2GwZgLqNCy9AX3kOf09Mva68\nezVTmdpDRcPF6Vej0f25Tip9kTI+KKImLl18FJhIxoXlF5+Tqqh0s5/OZLupP/ZI\n84To1T/xQBFdLZ0S0vT2zw2DlnHRCCGrUF5/1eLqw5D9OZ7uW9/GnF/oEzYmBjdu\nbY+Q2TOvp9v2hYWyo1dN3oALPHjHAEpARCq4XfhBouvGEtDFWC5JQyBRuQkM7dO0\nZQ6cc7i6MVgqqoPpzuffbcI+sfFjiXIVtLXG/MPHi6dnqWiYGQv1iulZYrReyJlk\nIAawVuL3wd5wdBVR3mMbdBTUCNKj6Z5Zv+mzJqDTsQKBgQD7jEpYakZXzQo0wlWg\nOxNM3H54MKZ+AexO3Dl9QcWT2YQltRR3xo80O8izybXELXk+tqzsdMaihYUn7GmJ\npzwLwPewqLnibEDTxdmW5u993riAYmEqFqB8hD2OjK29xrj92fJ6/MGbbJX2N5m3\n1PY4jcahFX3Adn111K0gbV27lQKBgQD2iOq5WmwU5YzWYlh29bhKCuk5BbY8w54e\nMd0akpiXXWlB181SDECOpuP8tcyoOjCa3tT3ortVJXbcN8mBwUHCjEomaEVUyao0\nX/AEmDVTTMyaq1V/yPtqvvZikFuMPybbUerlEiS5Vq+TiMyaDRMSU+XOSrb6iNSX\neYJ3sD5SZQKBgBO4kfOQkWc8yfoM6k2flAnIl5mwprzmRbKBDXjGeUj4GqYiJjKl\nvIBp13hQ7hEtR34lMDVxikkfkqrom/WQyOJbBJAzCi+4MPTpY/+yp0AFAA4AqIF2\nOKrKa1ELsmtYcxRjy+DchAk9YBxni4OgDJWud84VM0CtiXR9cf1C1cBpAoGAA36j\nXSdD+vPaEDvqpx0KlLoc3jsPf0MCncj1KmhDk3m2gUFu3qffzmXdO3rUQNo6UCey\neyQqZaWXTr3XtGgp53kXn/3AZdhJ+l4Vx+rkbp7bE6I0HxCZR8UXNwR218EZauh5\nXO/p51qsOHoq9FAVIiBgVJFIkLqZ0N/fEpVD/OUCgYAYQDYcNPS1lMSSZRh6V8jh\nhUfofAi1KnrrYluH7LfKQxpiPdRnR6flqDLbspx+6+npHXK3uTiKAjrD5CA6MRNh\ngt7tB+AVFoojDgmIz+WcRx/4BKsrFBhZgav8gJD/B5hcE+0+SbK8SzyVa2z9ksAn\nLC2ebOxxckJoz6ExckxU9w==\n-----END PRIVATE KEY-----\n",
  "client_email": "taxai-drive@taxai-473614.iam.gserviceaccount.com",
  "client_id": "112734673725470720797",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/taxai-drive%40taxai-473614.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
}

def _read_private_file(file_url: str) -> bytes:
    # file_url from File doctype, must be private
    path = frappe.get_site_path(file_url.lstrip("/"))
    with open(path, "rb") as f:
        return f.read()

def _sa_creds():
    s = frappe.get_single("Google Drive Settings")
    if not s.sa_json_file:
        frappe.throw("Upload Service Account JSON in Google Drive SA Settings.")
    sa_bytes = _read_private_file(s.sa_json_file)
    info = json.loads(sa_bytes.decode("utf-8"))
    scopes = SCOPES
    return Credentials.from_service_account_info(info, scopes=scopes)

def drive_service():
    return build("drive", "v3", credentials=_sa_creds(), cache_discovery=False)

def list_pdfs(folder_id: str, include_shared_drives: bool=True, page_token: Optional[str]=None):
    svc = drive_service()
    q = f"'{folder_id}' in parents and mimeType='application/pdf' and trashed=false"
    kwargs = {
        "q": q,
        "pageSize": 1000,
        "fields": "nextPageToken, files(id,name,modifiedTime,md5Checksum,parents,driveId)",
        "supportsAllDrives": include_shared_drives,
        "includeItemsFromAllDrives": include_shared_drives,
    }
    if page_token:
        kwargs["pageToken"] = page_token
    return svc.files().list(**kwargs).execute()

def list_all_pdfs(folder_id: str, include_shared_drives: bool=True):
    files = []
    token = None
    while True:
        res = list_pdfs(folder_id, include_shared_drives, token)
        files.extend(res.get("files", []))
        token = res.get("nextPageToken")
        if not token:
            break
    return files

def download_pdf(file_id: str, include_shared_drives: bool=True) -> bytes:
    svc = drive_service()
    req = svc.files().get_media(fileId=file_id, supportsAllDrives=include_shared_drives)
    buf = io.BytesIO()
    dl = MediaIoBaseDownload(buf, req)
    done = False
    while not done:
        status, done = dl.next_chunk()
    return buf.getvalue()

def get_file_meta(file_id: str, include_shared_drives: bool=True) -> Dict:
    svc = drive_service()
    return svc.files().get(
        fileId=file_id,
        fields="id,name,parents,md5Checksum,mimeType,modifiedTime,driveId",
        supportsAllDrives=include_shared_drives
    ).execute()
