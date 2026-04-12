import os
import json
import csv
import logging
import argparse
from datetime import datetime
from pathlib import Path

import requests
from cryptography.fernet import Fernet

# ─────────────────────────────────────────────
# 設定 Logging
# ─────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# 設定常數
# ─────────────────────────────────────────────
SUPABASE_URL = "https://yrccanqxzrcoknzabifz.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
BACKUP_ENCRYPT_KEY = os.getenv("BACKUP_ENCRYPT_KEY")  # Fernet 金鑰，若未設定則不加密
SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL")    # 若未設定則不發送通知

BACKUP_DIR = Path("backups")
HISTORY_FILE = BACKUP_DIR / "backup_history.json"
ANOMALY_THRESHOLD = 0.3  # 資料量變化超過 30% 就警告


# ══════════════════════════════════════════════
# 1. 資料擷取
# ══════════════════════════════════════════════

def get_headers() -> dict:
    if not SUPABASE_KEY:
        raise EnvironmentError("環境變數 SUPABASE_ANON_KEY 未設定！")
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }


def fetch_all_flights(headers: dict) -> list:
    """取得全部航班資料。"""
    url = f"{SUPABASE_URL}/rest/v1/flights?select=*"
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()


def fetch_incremental_flights(headers: dict, since: str) -> list:
    """只取上次備份時間之後的新航班（增量備份）。"""
    url = f"{SUPABASE_URL}/rest/v1/flights?created_at=gt.{since}&select=*&order=created_at.asc"
    response = requests.get(url, headers=headers, timeout=10)
    response.raise_for_status()
    return response.json()


# ══════════════════════════════════════════════
# 2. 儲存功能
# ══════════════════════════════════════════════

def save_json(data: list, timestamp: str) -> Path:
    """存成帶時間戳的 JSON 檔。"""
    path = BACKUP_DIR / f"flight_log_{timestamp}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    logger.info(f"JSON 已儲存：{path}")
    return path


def save_csv(data: list) -> Path | None:
    """存成 CSV（Excel 友善的 utf-8-sig）。"""
    if not data:
        logger.warning("資料為空，略過 CSV 輸出。")
        return None
    path = BACKUP_DIR / "flight_log_latest.csv"
    keys = data[0].keys()
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        writer.writerows(data)
    logger.info(f"CSV 已儲存：{path}")
    return path


# ══════════════════════════════════════════════
# 3. 備份加密 / 解密
# ══════════════════════════════════════════════

def encrypt_file(path: Path) -> Path:
    """將指定檔案加密，產生 .enc 檔並刪除原檔。"""
    if not BACKUP_ENCRYPT_KEY:
        return path  # 未設定金鑰則略過
    fernet = Fernet(BACKUP_ENCRYPT_KEY.encode())
    encrypted = fernet.encrypt(path.read_bytes())
    enc_path = path.with_suffix(path.suffix + ".enc")
    enc_path.write_bytes(encrypted)
    path.unlink()
    logger.info(f"已加密：{enc_path}")
    return enc_path


def decrypt_file(enc_path: Path) -> Path:
    """解密 .enc 檔，還原成原始檔案。"""
    if not BACKUP_ENCRYPT_KEY:
        raise EnvironmentError("環境變數 BACKUP_ENCRYPT_KEY 未設定，無法解密！")
    fernet = Fernet(BACKUP_ENCRYPT_KEY.encode())
    decrypted = fernet.decrypt(enc_path.read_bytes())
    # 移除 .enc 後綴
    original_path = enc_path.with_suffix("")
    original_path.write_bytes(decrypted)
    logger.info(f"已解密：{original_path}")
    return original_path


# ══════════════════════════════════════════════
# 4. 資料驗證與異常偵測
# ══════════════════════════════════════════════

def validate_backup(data: list, min_expected: int = 1):
    """驗證備份資料筆數是否合理。"""
    if len(data) < min_expected:
        raise ValueError(f"資料筆數異常：只有 {len(data)} 筆，預期至少 {min_expected} 筆")


def detect_anomaly(current_count: int, previous_count: int):
    """若資料量變化超過閾值，發出警告。"""
    if previous_count == 0:
        return
    change_rate = abs(current_count - previous_count) / previous_count
    if change_rate > ANOMALY_THRESHOLD:
        msg = (f"⚠️ 資料量變化異常！"
               f"{previous_count} → {current_count} "
               f"（變化 {change_rate:.1%}，閾值 {ANOMALY_THRESHOLD:.0%}）")
        logger.warning(msg)
        notify_slack(msg)


# ══════════════════════════════════════════════
# 5. 統計分析
# ══════════════════════════════════════════════

def generate_summary(data: list, timestamp: str) -> Path:
    """產生備份摘要報告。"""
    path = BACKUP_DIR / f"summary_{timestamp}.txt"
    lines = [
        f"=== 航班備份摘要報告 ===",
        f"備份時間：{timestamp}",
        f"總筆數：{len(data)} 筆",
    ]

    if data:
        # 最新一筆
        last = data[-1]
        lines.append(f"最新紀錄 ID：{last.get('id', 'N/A')}")

        # 統計最常出現的出發地 / 目的地（若欄位存在）
        for field in ("departure", "destination", "airline"):
            if field in last:
                counts = {}
                for row in data:
                    val = row.get(field, "未知")
                    counts[val] = counts.get(val, 0) + 1
                top = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:3]
                lines.append(f"Top 3 {field}：" + "、".join(f"{k}({v}次)" for k, v in top))

    lines.append("=" * 24)
    report = "\n".join(lines)
    path.write_text(report, encoding="utf-8")
    logger.info(f"摘要報告：{path}")
    print("\n" + report + "\n")
    return path


# ══════════════════════════════════════════════
# 6. 備份歷史紀錄
# ══════════════════════════════════════════════

def load_history() -> list:
    if HISTORY_FILE.exists():
        return json.loads(HISTORY_FILE.read_text(encoding="utf-8"))
    return []


def save_history(history: list):
    HISTORY_FILE.write_text(json.dumps(history, ensure_ascii=False, indent=2), encoding="utf-8")


def append_history(timestamp: str, count: int, success: bool, mode: str, encrypted: bool):
    history = load_history()
    history.append({
        "timestamp": timestamp,
        "count": count,
        "success": success,
        "mode": mode,
        "encrypted": encrypted
    })
    save_history(history)


def get_last_backup_time() -> str | None:
    """取得上次成功備份的時間（用於增量備份）。"""
    history = load_history()
    for record in reversed(history):
        if record.get("success"):
            return record["timestamp"]
    return None


# ══════════════════════════════════════════════
# 7. 通知
# ══════════════════════════════════════════════

def notify_slack(message: str):
    if not SLACK_WEBHOOK_URL:
        return
    try:
        requests.post(SLACK_WEBHOOK_URL, json={"text": message}, timeout=5)
    except Exception as e:
        logger.warning(f"Slack 通知失敗：{e}")


# ══════════════════════════════════════════════
# 8. 清理舊備份
# ══════════════════════════════════════════════

def cleanup_old_backups(keep: int = 7):
    """保留最新 N 份 JSON 備份，刪除其餘舊檔。"""
    files = sorted(BACKUP_DIR.glob("flight_log_*.json*"))
    to_delete = files[:-keep] if len(files) > keep else []
    for old_file in to_delete:
        old_file.unlink()
        logger.info(f"已刪除舊備份：{old_file.name}")


# ══════════════════════════════════════════════
# 9. 還原功能
# ══════════════════════════════════════════════

def restore_from_backup(filepath: str):
    """從 JSON 備份檔還原資料到 Supabase。"""
    path = Path(filepath)

    # 若為加密檔先解密
    if path.suffix == ".enc":
        path = decrypt_file(path)

    data = json.loads(path.read_text(encoding="utf-8"))
    if not data:
        logger.warning("備份檔為空，略過還原。")
        return

    headers = get_headers()
    headers["Content-Type"] = "application/json"
    headers["Prefer"] = "resolution=merge-duplicates"  # 避免重複插入

    url = f"{SUPABASE_URL}/rest/v1/flights"
    response = requests.post(url, headers=headers, json=data, timeout=30)
    response.raise_for_status()
    logger.info(f"✅ 還原成功！共 {len(data)} 筆資料已寫回 Supabase。")


# ══════════════════════════════════════════════
# 10. 主要備份流程
# ══════════════════════════════════════════════

def backup_data(incremental: bool = False, encrypt: bool = False, keep: int = 7):
    headers = get_headers()
    BACKUP_DIR.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    mode = "incremental" if incremental else "full"

    try:
        # 擷取資料
        if incremental:
            last_time = get_last_backup_time()
            if not last_time:
                logger.info("找不到上次備份紀錄，改用完整備份。")
                data = fetch_all_flights(headers)
            else:
                # 將時間戳轉為 ISO 格式
                dt = datetime.strptime(last_time, "%Y%m%d_%H%M%S")
                data = fetch_incremental_flights(headers, dt.isoformat())
                logger.info(f"增量備份：抓取 {last_time} 之後的資料")
        else:
            data = fetch_all_flights(headers)

        # 驗證
        validate_backup(data)

        # 異常偵測（與上次備份比較）
        history = load_history()
        if history:
            prev_count = history[-1].get("count", 0)
            detect_anomaly(len(data), prev_count)

        # 儲存
        json_path = save_json(data, timestamp)
        save_csv(data)
        generate_summary(data, timestamp)

        # 加密
        if encrypt:
            json_path = encrypt_file(json_path)

        # 清理舊備份
        cleanup_old_backups(keep=keep)

        # 紀錄歷史
        append_history(timestamp, len(data), True, mode, encrypt)

        msg = f"✅ 備份成功！模式：{mode}，共 {len(data)} 筆，時間：{timestamp}"
        logger.info(msg)
        notify_slack(msg)

    except Exception as e:
        logger.error(f"❌ 備份失敗：{e}")
        append_history(timestamp, 0, False, mode, encrypt)
        notify_slack(f"❌ 備份失敗：{e}")
        raise


# ══════════════════════════════════════════════
# 11. CLI 介面
# ══════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Flight Passport 備份工具")
    subparsers = parser.add_subparsers(dest="command")

    # backup 指令
    backup_parser = subparsers.add_parser("backup", help="執行備份")
    backup_parser.add_argument("--incremental", action="store_true", help="增量備份（只備份新資料）")
    backup_parser.add_argument("--encrypt", action="store_true", help="加密備份檔案")
    backup_parser.add_argument("--keep", type=int, default=7, help="保留最近幾份備份（預設 7）")

    # restore 指令
    restore_parser = subparsers.add_parser("restore", help="從備份檔還原資料")
    restore_parser.add_argument("--file", required=True, help="備份檔路徑（.json 或 .json.enc）")

    # history 指令
    subparsers.add_parser("history", help="顯示備份歷史紀錄")

    # stats 指令
    subparsers.add_parser("stats", help="顯示最新備份的統計摘要")

    # keygen 指令
    subparsers.add_parser("keygen", help="產生一組新的加密金鑰")

    args = parser.parse_args()

    if args.command == "backup":
        backup_data(incremental=args.incremental, encrypt=args.encrypt, keep=args.keep)

    elif args.command == "restore":
        restore_from_backup(args.file)

    elif args.command == "history":
        history = load_history()
        if not history:
            print("尚無備份紀錄。")
        else:
            print(f"\n{'時間':<20} {'模式':<14} {'筆數':>6} {'加密':<6} {'狀態'}")
            print("-" * 56)
            for h in history[-20:]:  # 顯示最近 20 筆
                status = "✅ 成功" if h["success"] else "❌ 失敗"
                enc = "🔒 是" if h.get("encrypted") else "否"
                print(f"{h['timestamp']:<20} {h['mode']:<14} {h['count']:>6} {enc:<6} {status}")
            print()

    elif args.command == "stats":
        summaries = sorted(BACKUP_DIR.glob("summary_*.txt"))
        if summaries:
            print(summaries[-1].read_text(encoding="utf-8"))
        else:
            print("尚無統計摘要，請先執行備份。")

    elif args.command == "keygen":
        key = Fernet.generate_key().decode()
        print(f"\n🔑 新加密金鑰（請存入環境變數 BACKUP_ENCRYPT_KEY）：\n{key}\n")

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
