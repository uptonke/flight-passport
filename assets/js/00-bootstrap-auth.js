// 🌍 Globals & Framer Motion Setup
const MAPBOX_TOKEN = 'pk.eyJ1IjoidXB0b25rZSIsImEiOiJjbW5sNnNwajAxNnY2MnJvZ3kzcDNqN2NlIn0.oriWVIXM8Oy80ZExDHSJUA';
mapboxgl.accessToken = MAPBOX_TOKEN; 
const SUPABASE_URL = 'https://yrccanqxzrcoknzabifz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lDfwRDxgMhzRwVk0-Qu3vg_9HTmTFZy';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let airportDB = {}; 
let editingFlightId = null;
let currentYearFilter = 'ALL';
let currentFlightSearch = '';
let currentFlightSort = 'date_desc';
let currentSignalRange = '1Y';
let animationState = { startTime: 0, planes: [], isRunning: false };
let isAppInitialized = false;
let isGlobe = true;
let isNightMode = false;

// 🎥 新增：電影跟隨鏡頭狀態與「避震器」
let cinematicMode = false;
let followedPlaneObj = null;
let cinematicCamera = { lng: 0, lat: 0, bearing: 0, pitch: 0, zoom: 0 };

// Auth & Session
async function checkAuth() {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (session) {
        hideLoginOverlay();
        initApp();
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = document.getElementById('login-btn');
    const errorDiv = document.getElementById('login-error');

    btn.innerText = 'AUTHENTICATING...';
    errorDiv.classList.add('hidden');

    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: email, password: password });

    if (error) {
        errorDiv.innerText = 'Access Denied: ' + error.message;
        errorDiv.classList.remove('hidden');
        btn.innerText = 'LOGIN 登入';
    } else {
        hideLoginOverlay();
        initApp();
    }
}

async function handleLogout() {
    await supabaseClient.auth.signOut();
    window.location.reload();
}

function hideLoginOverlay() {
    const overlay = document.getElementById('login-overlay');
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 500);
}

document.addEventListener('DOMContentLoaded', checkAuth);

// Framer Motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const motionTokens = { fast: 0.16, base: 0.24, slow: 0.36, spring: { type: 'spring', bounce: 0.16, duration: 0.42 } };
window.appMotion = {
    prefersReducedMotion,
    tokens: motionTokens,
    enabled: () => Boolean(animate) && !prefersReducedMotion.matches
};
let animate, stagger, spring;
import("https://cdn.jsdelivr.net/npm/motion@11.11.13/+esm").then(module => {
    animate = module.animate; stagger = module.stagger; spring = module.spring;
}).catch(e => {
    console.warn("動畫引擎載入失敗，使用降級模式");
});

const airlineDB = {
    'BR': '長榮航空 EVA Air', 'CI': '中華航空 China Airlines', 'JX': '星宇航空 STARLUX', 
    'IT': '台灣虎航 Tigerair Taiwan', 'AE': '華信航空 Mandarin', 'B7': '立榮航空 UNI Air',
    'JL': '日航航空 Japan Airlines', 'NH': '全日空 ANA', 
    'MM': '樂桃航空 Peach', 'GK': '捷星日本 Jetstar Japan', 'BC': '天馬航空 Skymark', 'ZG': 'ZIPAIR',
    'KE': '大韓航空 Korean Air', 'OZ': '韓亞航空 Asiana', 
    '7C': '濟州航空 Jeju Air', 'TW': '德威航空 T\'way', 'LJ': '真航空 Jin Air', 'BX': '釜山航空 Air Busan',
    'CX': '國泰航空 Cathay Pacific', 'UO': '香港快運 HK Express', 'HX': '香港航空 Hong Kong Airlines', 
    'NX': '澳門航空 Air Macau', 'CA': '中國航空 Air China', 'MU': '東方航空 China Eastern', 
    'CZ': '南方航空 China Southern', 'MF': '廈門航空 XiamenAir', '9C': '春秋航空 Spring Airlines', 
    'ZH': '深圳航空 Shenzhen Airlines','HB': '大灣區航空 Greater bay Airlines',
    'SQ': '新加坡航空 Singapore Airlines', 'TR': '酷航 Scoot', '3K': '捷星亞洲 Jetstar Asia',
    'MH': '馬航 Malaysia Airlines', 'AK': '亞航 AirAsia', 'D7': '全亞航 AirAsia X',
    'TG': '泰國航空 Thai Airways', 'FD': '泰亞航 Thai AirAsia', 'VZ': '泰越捷 Thai Vietjet',
    'VN': '越南航空 Vietnam Airlines', 'VJ': '越捷 VietJet', 
    'PR': '菲律賓航空 Philippine Airlines', '5J': '宿霧太平洋 Cebu Pacific', 
    'GA': '印尼鷹航 Garuda Indonesia', 'JT': '獅航 Lion Air',
    'AA': '美國航空 American Airlines', 'DL': '達美航空 Delta', 'UA': '聯合航空 United Airlines', 
    'WN': '西南航空 Southwest Airlines', 'AS': '阿拉斯加航空 Alaska Airlines', 'B6': '捷藍 JetBlue',
    'NK': '精神航空 Spirit Airlines', 'F9': '邊疆航空 Frontier Airlines', 'AC': '加拿大航空 Air Canada',
    'BA': '英國航空 British Airways', 'LH': '德國航空 Lufthansa', 'AF': '法國航空 Air France', 
    'KL': '荷蘭航空 KLM', 'LX': '瑞航 SWISS', 'AY': '芬蘭航空 Finnair', 'TK': '土耳其航空 Turkish Airlines',
    'U2': '易捷 easyJet', 'FR': '瑞安航空 Ryanair', 'W6': '威茲航空 Wizz Air', 'VY': '伏林航空 Vueling', 'TP': '葡萄牙航空 TAP Air Portugal',
    'EK': '阿聯酋航空 Emirates', 'QR': '卡達航空 Qatar Airways', 'EY': '阿提哈德航空 Etihad Airways'
};
// 🎨 航空公司品牌色 (Due Diligence: 針對暗黑地圖模式微調的高識別度企業色)
const airlineColors = {
    // 🇹🇼 台灣
    'BR': '#00A651', // 長榮綠
    'CI': '#9C99CC', // 華航機腹薰衣草紫灰 (尊守物理還原)
    'JX': '#C8A161', // 星宇大地金
    'IT': '#FFCC00', // 虎航黃
    'AE': '#35A8E0', // 華信海豚淺藍
    'B7': '#FF6600', // 立榮橘
    
    // 🇯🇵 日本
    'JL': '#CC0000', // 日航鶴丸紅
    'NH': '#0033A0', // 全日空 Inspiration Blue
    'MM': '#B00062', // 樂桃粉紫
    'GK': '#FF6600', // 捷星日本橘
    'BC': '#FFD100', // 天馬星辰黃
    'ZG': '#A4D65E', // ZIPAIR 螢光綠線條
    
    // 🇰🇷 韓國
    'KE': '#0066B3', // 大韓湖水藍
    'OZ': '#A60021', // 韓亞紅
    '7C': '#FF5000', // 濟州橘
    'TW': '#D22630', // 德威番茄紅
    'LJ': '#B4D330', // 真航空蘋果綠
    'BX': '#0071C5', // 釜山海灣藍
    
    // 🇭🇰 🇲🇴 港澳
    'CX': '#006564', // 國泰玉石綠
    'UO': '#7E2980', // 香港快運紫
    'HX': '#DA291C', // 香港航空紫荊紅
    'NX': '#E3001B', // 澳門航空紅
    
    // 🇨🇳 中國
    'CA': '#E60012', // 國航紅
    'MU': '#E3001B', // 東航紅
    'CZ': '#009EDB', // 南航木棉藍
    'MF': '#0084FF', // 廈航白鷺藍
    '9C': '#008000', // 春秋綠
    'ZH': '#E60012', // 深航紅
    'HB': '#4CB5E6', // 大灣區天空藍
    
    // 🇸🇬 🇲🇾 🇹🇭 🇻🇳 🇵🇭 🇮🇩 東南亞
    'SQ': '#FBA617', // 新航皇家金
    'TR': '#FFE900', // 酷航亮黃
    '3K': '#FF6600', // 捷星亞洲橘
    'MH': '#00A3E0', // 馬航風箏淺藍
    'AK': '#FF0000', // 亞航紅
    'D7': '#FF0000', // 全亞航紅
    'TG': '#4B2682', // 泰航蘭花紫
    'FD': '#FF0000', // 泰亞航紅
    'VZ': '#E3001B', // 泰越捷紅
    'VN': '#006F7A', // 越南航空蓮花青
    'VJ': '#ED1B24', // 越捷紅
    'PR': '#0038A8', // 菲律賓航空藍
    '5J': '#FAD20A', // 宿霧太平洋黃
    'GA': '#005C8A', // 印尼鷹航青
    'JT': '#E3001B', // 獅航紅
    
    // 🇺🇸 🇨🇦 北美
    'AA': '#C30019', // 美國航空紅
    'DL': '#E51636', // 達美紅
    'UA': '#005DAA', // 聯合藍
    'WN': '#304CB2', // 西南航空大膽藍
    'AS': '#00827E', // 阿拉斯加極光青
    'B6': '#003876', // 捷藍
    'NK': '#FFEA00', // 精神航空計程車黃
    'F9': '#007A33', // 邊疆綠
    'AC': '#D80621', // 加航楓葉紅
    
    // 🇪🇺 歐洲
    'BA': '#072A6C', // 英航深藍
    'LH': '#FFAC00', // 漢莎鶴丸黃 (深藍在黑地圖會隱形，改用高對比品牌黃)
    'AF': '#00205B', // 法航海軍藍
    'KL': '#00A1DE', // 荷航淺藍
    'LX': '#E3001B', // 瑞航紅
    'AY': '#0B1560', // 芬蘭深藍
    'TK': '#E3000F', // 土耳其紅
    'U2': '#FF6600', // 易捷橘
    'FR': '#F1C933', // 瑞安豎琴黃
    'W6': '#C60C85', // 威茲粉紫
    'VY': '#FFCC00', // 伏林黃
    'TP': '#00675A', // 葡萄牙航空綠
    
    // 🇦🇪 🇶🇦 中東
    'EK': '#D71921', // 阿聯酋紅
    'QR': '#5C0632', // 卡達勃艮第酒紅
    'EY': '#B89D5E'  // 阿提哈德沙漠金
};
let flightsState = [];
const setFlights = (newData) => {
    flightsState = newData;
    triggerReactRender();
};

