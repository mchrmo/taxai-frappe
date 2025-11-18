# your_app/integrations/gdrive_sa.py
import json, io, time
import frappe
from typing import Dict, List, Optional
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from google.oauth2.service_account import Credentials
from googleapiclient.errors import HttpError

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

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
    return Credentials.from_service_account_info(info, scopes=SCOPES)

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
