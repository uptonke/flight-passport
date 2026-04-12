import os
import requests
import json
import csv
from datetime import datetime

# 從環境變數讀取金鑰（安全 Due Diligence）
SUPABASE_URL = "https://yrccanqxzrcoknzabifz.supabase.co"
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

def backup_data():
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}"
    }
    
    # 1. 向 Supabase 請求所有航班紀錄
    response = requests.get(f"{SUPABASE_URL}/rest/v1/flights?select=*", headers=headers)
    
    if response.status_code == 200:
        data = response.json()
        
        # 建立備份目錄
        if not os.path.exists('backups'):
            os.makedirs('backups')
            
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 2. 存成 JSON (完整資料結構)
        with open(f'backups/flight_log_{timestamp}.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            
        # 3. 存成 CSV (方便 Excel 直接讀取分析)
        if data:
            keys = data[0].keys()
            with open(f'backups/flight_log_latest.csv', 'w', newline='', encoding='utf-8-sig') as f:
                dict_writer = csv.DictWriter(f, field_keys=keys)
                dict_writer.writeheader()
                dict_writer.writerows(data)
                
        print(f"✅ 備份成功！時間：{timestamp}")
    else:
        print(f"❌ 備份失敗，錯誤代碼：{response.status_code}")
        exit(1)

if __name__ == "__main__":
    backup_data()
