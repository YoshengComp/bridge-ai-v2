// ======================================================
// Bridge AI v2.1
// ERP AI Assistant Framework
// Company : 佑陞資訊 YOSHENG
// Product : Bridge ERP
// ======================================================
//
// 說明：
// Bridge AI 為 ERP AI 助理，主要提供：
//
// 1. ERP 知識問答
// 2. 缺貨分析
// 3. AI 建立採購單
// 4. 採購內容編輯 (Purchase Draft Workspace)
// 5. 後續擴充：進貨、出貨、報價、庫存、財務...等 AI Agent
//
// 設計原則：
// • AI 與 ERP 分離
// • Purchase Draft 為唯一採購資料來源
// • 每張 PO 擁有獨立 Header
// • 支援未來更換資料庫(Ragic / MySQL / SQL Server)
// • 支援未來串接 OpenAI / Azure OpenAI / Gemini
//
// ======================================================



// ======================================================
// Cloudflare Worker API
// ======================================================

const API_URL = "https://bridge-ai-api.yosheng96750043.workers.dev/";



// ======================================================
// Runtime Data
// ======================================================

// 最近一次 ERP 查詢結果
// (例如：缺貨商品、查詢結果...)
let lastResultData = [];

// 採購草稿 Workspace
// AI 分析完成後所有資料皆存放於此
let purchaseDraft = [];



// ======================================================
// AI Conversation State
// ======================================================
//
// 僅保存聊天流程狀態
//
// 注意：
// Header 資訊將逐步搬移至 purchaseDraft
// conversation 不再保存正式採購資料
//
// ======================================================

let conversation = {

    // 目前聊天流程
    step: "",

    // 採購草稿 (同步參考)
    purchaseDraft: [],

    // ===== 以下欄位後續將 Deprecated =====

    deliveryAddress: "",

    supplierAddress: "",

    requestDate: "",

    remark: ""

};



// ======================================================
// DOM
// ======================================================

const chat = document.getElementById("chat");

const messages = document.getElementById("messages");

const welcome = document.getElementById("welcome");

const input = document.getElementById("question");

const sendButton = document.getElementById("send");

const quickButtons = document.querySelectorAll(".quick-btn");



// ======================================================
// UI State
// ======================================================

// 是否開始聊天
let started = false;



// ======================================================
// Event Binding
// ======================================================

// 送出訊息
sendButton.addEventListener("click", sendMessage);

// Enter 送出
input.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {

        sendMessage();

    }

});

// 首頁快速提問
quickButtons.forEach(function (button) {

    button.addEventListener("click", function () {

        input.value = button.dataset.question;

        sendMessage();

    });

});



// ======================================================
// Chat Controller
// sendMessage()
// ======================================================

async function sendMessage() {

    const question = input.value.trim();

    if (question === "") return;

    // 第一次聊天後隱藏首頁
    if (!started) {

        started = true;

        welcome.style.display = "none";

    }

    addUserMessage(question);

    input.value = "";
// ----------------------------------
// 輸入交貨地址
// ----------------------------------

if (conversation.step === "input_delivery_address") {

    conversation.deliveryAddress = question;

    conversation.step = "ask_request_date";

    console.log(conversation);

    addAIMessage(
        "📅 請問要求到貨日？\n\n例如：2026/08/15"
    );

    return;

}



// ----------------------------------
// 輸入到貨日期
// ----------------------------------

if (conversation.step === "ask_request_date") {

    conversation.requestDate = question;

    conversation.step = "ask_remark";

    console.log(conversation);

    addAIMessage(
        "📝 請問有沒有備註？\n\n沒有請輸入：沒有"
    );

    return;

}



// ----------------------------------
// 輸入備註
// ----------------------------------

if (conversation.step === "ask_remark") {

    conversation.remark = question;

    conversation.step = "confirm_purchase";

    showPurchaseConfirm();

    return;

}



// ======================================================
// Header 修改 (Deprecated)
// ======================================================
//
// 後續將改為：
//
// purchaseDraft[index]
//
// ======================================================



if (conversation.step === "edit_delivery") {

    conversation.deliveryAddress = question;

    conversation.step = "confirm_purchase";

    showPurchaseConfirm();

    return;

}



if (conversation.step === "edit_request_date") {

    conversation.requestDate = question;

    conversation.step = "confirm_purchase";

    showPurchaseConfirm();

    return;

}



if (conversation.step === "edit_remark") {

    conversation.remark = question;

    conversation.step = "confirm_purchase";

    showPurchaseConfirm();

    return;

}



// ======================================================
// Worker Query
// ======================================================

const loading = addLoading();

try {

    const response = await fetch(API_URL, {

        method: "POST",

        headers: {

            "Content-Type": "application/json"

        },

        body: JSON.stringify({

            question: question

        })

    });

    const result = await response.json();

    console.log("Worker 回傳：", result);



    // ==========================================
    // Runtime Data
    // ==========================================

    lastResultData = result.data || [];



    const icon = result.icon || "";

    const category = result.category || "";

    const answer = result.answer || "";



    loading.remove();



    if (result.success) {

        let message = `${icon} ${category}

${answer}`;



        if (result.data && result.data.length > 0) {

            message += `

📋 目前共有 ${result.data.length} 項商品庫存不足。`;

        }



        addAIMessage(

            message,

            result.buttons,

            result.data

        );



    } else {

        addAIMessage("查詢失敗：" + result.error);

    }

}
catch (e) {

    loading.remove();

    addAIMessage("無法連線 Cloudflare Worker");

}

}



// ======================================================
// User Message UI
// ======================================================

function addUserMessage(text) {

    const now = new Date();

    const time =

        now.getHours().toString().padStart(2, "0") +

        ":" +

        now.getMinutes().toString().padStart(2, "0");



    const div = document.createElement("div");

    div.className = "user-message";



    div.innerHTML = `

<div class="user-bubble">

${escapeHtml(text)}

</div>

<div class="message-time">

${time}

</div>

`;



    messages.appendChild(div);

    scrollBottom();

}



// ======================================================
// AI Message UI
// ======================================================

function addAIMessage(text, buttons = [], data = [], showData = false) {

    const div = document.createElement("div");

    div.className = "ai-message";



    div.innerHTML = `

<div class="card-header">

<div class="card-title">

🤖 Bridge AI

</div>

</div>

<div class="card-body">

${formatMessage(text)}

</div>

${showData && data.length ? `

${data.map(item => `

<div class="erp-name">

📦 ${item["商品"] || ""}

</div>

<div class="erp-info">

<div class="erp-row">

<span>📦 庫存</span>

<strong>${item["庫存"] || "-"}</strong>

</div>

<div class="erp-row">

<span>🛡️ 安全庫存</span>

<strong>${item["安全庫存"] || "-"}</strong>

</div>

</div>

`).join("")}

` : ""}

${buttons.length ? `

${buttons.map(button => `

<button

class="action-btn ${button.color || "primary"}"

onclick="handleAction('${button.action}','${button.url || ""}')">

<span class="btn-icon">${button.icon || ""}</span>

<span>${button.text}</span>

</button>

`).join("")}

` : ""}

`;



    messages.appendChild(div);

    scrollBottom();

}
// ========================================
// Bridge AI 動作
// ========================================

async function handleAction(action, url) {

    switch (action) {

        case "show_detail":

            addAIMessage(
                "📋 以下為目前庫存不足商品：",
                [],
                lastResultData,
                true
            );

            break;

        case "open_form":
            addAIMessage(
        "您希望使用哪種方式建立採購單？",
        [
            {
                text: "🤖 AI 協助建立採購單",
                action: "agent"
            },
            {
                text: "📝 自行建立採購單",
                action: "open_form_direct",
                url: url
            }
        ]
    );

    break;

         case "open_form_direct":

    if (!url) {
        alert("尚未設定網址");
        return;
    }

    window.open(url, "_blank");

    break;
            
case "agent":

    console.log("agent 被點擊了");

    let message = "🤖 好的，我將協助您建立採購單。\n\n";

    message += "請問是否將目前缺貨商品全部加入採購單？\n\n";

    if (lastResultData.length > 0) {

        lastResultData.forEach(item => {

            message += `📦 ${item["商品"]}\n`;

        });

    }
  
    addAIMessage(
        message,
        [
            {
                text: "✅ 全部加入",
                action: "procurement_all"
            },
            {
                text: "✏️ 自行挑選",
                action: "procurement_select"
            }
        ]
    );

    break;
          
case "procurement_all":
   

     addAIMessage("🔍 正在分析商品供應商...");
       setTimeout(async () => {

        const products = lastResultData.map(item => item["產品編號"]);

const res = await fetch(API_URL, {

    method: "POST",

    headers: {
        "Content-Type": "application/json"
    },

    body: JSON.stringify({

        queryType: "vendor_analysis",

        products: products

    })

});

const result = await res.json();
purchaseDraft = result.data.map(group => ({

    ...group,

    deliveryAddress: "",

    requestDate: "",

    remark: ""

}));console.log("採購草稿：", purchaseDraft);
const groups = result.data;

let message = "📊 已分析完成。\n\n";

groups.forEach(group => {

    message += "━━━━━━━━━━━━━━\n\n";

    message += `🏢 ${group.vendorName}\n\n`;
    message += `📦 共 ${group.items.length} 項商品\n\n`;
    group.items.forEach(item => {

        message += `📦 ${item.productName}\n`;

    });

    message += "\n";

});

message += "━━━━━━━━━━━━━━\n\n";

message += `共找到 ${groups.length} 家供應商。\n\n`;

message += `預計建立 ${groups.length} 張採購單。`;

addAIMessage(
    message,
    [
        {
            text:"✏️ 編輯採購內容",
            action:"edit_purchase_draft"
        }
    ]
);

    },600);

    break;    
    case "create_po":

   console.log("目前採購草稿：", purchaseDraft);

    // 儲存目前採購資料
    conversation.purchaseDraft = purchaseDraft;

    // 下一步流程
    conversation.step = "ask_delivery_address";

    console.log(conversation);

    // ⭐ 開始詢問交貨地址
    askDeliveryAddress();

    break;
            case "delivery_taipei":

    conversation.deliveryAddress = "台北總公司";

    conversation.step = "ask_request_date";

    console.log(conversation);

    addAIMessage("📅 請問要求到貨日？\n\n例如：2026/08/15");

    break;


case "delivery_taoyuan":

    conversation.deliveryAddress = "桃園物流中心";

    conversation.step = "ask_request_date";

    console.log(conversation);

    addAIMessage("📅 請問要求到貨日？\n\n例如：2026/08/15");

    break;


case "delivery_other":

    conversation.deliveryAddress = "";

    conversation.step = "input_delivery_address";

    console.log(conversation);

    addAIMessage("✏️ 請直接輸入交貨地址。");

    break;
            case "confirm_create_po":

    await createPurchaseOrder();

    break;
            case "edit_purchase":

    conversation.step = "edit_menu";

    addAIMessage(
        "✏️ 請選擇要修改的項目",
        [
            {
                text:"📍 交貨地址",
                action:"edit_delivery"
            },
            {
                text:"📅 要求到貨日",
                action:"edit_request_date"
            },
            {
                text:"📝 備註",
                action:"edit_remark"
            },
            {
                text:"❌ 返回確認",
                action:"back_confirm"
            }
        ]
    );

    break;
      case "edit_request_date":

    conversation.step = "edit_request_date";

    addAIMessage("📅 請重新輸入要求到貨日");

    break;
     case "edit_delivery":

    conversation.step = "edit_delivery";

    addAIMessage("📍 請重新輸入交貨地址");

    break;       
   

    case "edit_remark":

    conversation.step = "edit_remark";

    addAIMessage("📝 請重新輸入備註");

    break;
            case "back_confirm":

    conversation.step = "confirm_purchase";

    showPurchaseConfirm();

    break;
    case "edit_purchase_draft":

    showPurchaseDraft();

    break;

case "edit_po_header":

purchaseDraft.forEach((group, index) => {

    addAIMessage(
        `🏢 ${group.vendorName}

📦 共 ${group.items.length} 項商品`,
        [
            {
                text: "📍 編輯交貨資訊",
                action: `edit_header_${index}`
            }
        ]
    );

});

break;
    default:

        console.warn("未知 Action：" + action);

}

} 

// ==========================================
// Loading
// ==========================================

function addLoading() {

    const div = document.createElement("div");

    div.className = "ai-message loading";

    div.innerHTML = `

        <div class="bubble ai-bubble">

            🤖 Bridge AI 思考中...

        </div>

    `;

    messages.appendChild(div);

    scrollBottom();

    return div;

}



// ==========================================
// 自動捲到底
// ==========================================

function scrollBottom() {

    chat.scrollTop = chat.scrollHeight;

}



// ==========================================
// HTML Escape
// ==========================================

function escapeHtml(text) {

    return text

        .replace(/&/g,"&amp;")

        .replace(/</g,"&lt;")

        .replace(/>/g,"&gt;");

}



// ==========================================
// AI格式化
// ==========================================

function formatMessage(text){

    return escapeHtml(text)

        .replace(/\r\n/g,"<br>")

        .replace(/\n/g,"<br>");

}

// ==========================================
// 建立操作按鈕
// ==========================================

function createActionButton(text, url, action){

    const button = document.createElement("button");

    button.className = "action-btn";

    button.innerHTML = text;

    button.onclick = function(){

        handleAction(action, url);

    };

    return button;

}



// ==========================================
// AI Card
// ==========================================

function createAnswerCard(answer){

    const card=document.createElement("div");

    card.className="answer-card";

    card.innerHTML=formatMessage(answer);

    return card;

}
function showInventoryDetail() {
    alert("下一步我們會改成顯示商品明細");
}

// ==========================================
// 建立採購單
// ==========================================

async function createPurchaseOrder() {

    addAIMessage("📄 正在建立採購單...");
    console.log("送出的 purchaseDraft：");
    console.log(conversation.purchaseDraft);

    const res = await fetch(API_URL, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify({

            queryType: "create_purchase_order",

            purchaseDraft: conversation.purchaseDraft,

            deliveryAddress: conversation.deliveryAddress,

            requestDate: conversation.requestDate,

            remark: conversation.remark

        })

    });

    const result = await res.json();

    console.log("createPurchaseOrder：", result);

if(result.success){

   
        conversation.createdPOs = result.createdPOs;

showCreatedPOs();

}else{

    addAIMessage(
        "❌ 建立失敗"
    );

}
  }   
// ==========================================
// 確認資訊
// ==========================================
function showPurchaseDraft() {

    let message = "📦 採購內容\n\n";

    purchaseDraft.forEach(group => {

       message += `🏢 ${group.vendorName}\n\n`;
    message += `📦 共 ${group.items.length} 項商品\n\n`;

        group.items.forEach(item => {

            message += `☑ ${item.productName}\n`;
            message += `📦 採購數量：${item.minQty}\n`;
            message += `✏️ 修改數量\n`;
            message += `🏢 更換供應商\n\n`;
            

        });
        // ← 一張 PO 共用資訊
    message += `📍 交貨地址：未設定\n`;
    message += `📅 到貨日期：未設定\n`;
    message += `📝 備註：未設定\n\n`;

        message += "────────────\n\n";

    });

    addAIMessage(
    message,
    [
        {
            text:"✏️ 編輯交貨資訊",
            action:"edit_po_header"
        },
        {
            text:"📄 建立全部採購單",
            action:"continue_create_po"
        }
    ]
);

}
   function showPurchaseConfirm() {

    addAIMessage(
`📋 請確認本次採購資訊

📍交貨地址：
${conversation.deliveryAddress}

📅 要求到貨日：
${conversation.requestDate}

📝 備註：
${conversation.remark}`,
[
{
text: "✅ 建立採購單",
action: "confirm_create_po"
},
{
text: "✏️ 修改",
action: "edit_purchase"
}
]
);

}
// ================================
// 顯示已建立採購單
// ================================

function showCreatedPOs() {

    let message = "✅ 已建立採購單\n\n";

    conversation.createdPOs.forEach((po) => {

        message +=
`🏢 ${po.vendorName}
${po.poNo}

`;

    });

    addAIMessage(
        message,
        [
            {
                text: "✏️ 修改採購單",
                action: "select_edit_po"
            },
            {
                text: "✅ 完成",
                action: "finish_purchase"
            }
        ]
    );

}
// ==========================================
// 詢問交貨地址
// ==========================================
function askDeliveryAddress() {

    addAIMessage(
        "📍 請問本次採購商品要送到哪裡？",
        [
            {
                text: "🏢 台北總公司",
                action: "delivery_taipei"
            },
            {
                text: "🏭 桃園物流中心",
                action: "delivery_taoyuan"
            },
            {
                text: "✏️ 其他地址",
                action: "delivery_other"
            }
        ]
    );

}
// ==========================================
// 後續AI Agent預留
// ==========================================

async function runAgent(action,data){

    console.log("AI Agent",action,data);

}



/*

V2

聊天

V2.1

建立採購單

V2.2

新增供應商

V2.3

開啟ERP表單

V3

AI Agent

*/
// ==========================================
// Bridge AI V2
// 預留企業功能
// ==========================================

/*

目前流程

使用者

↓

Cloudflare Worker

↓

Ragic AI

↓

answer

--------------------------------

之後 Ragic 可以增加：

answer
form_url
form_name
sop_url
sop_name
action
button_text

例如

{

 answer:"建立流程...",

 form_url:"https://ap16.ragic.com/...",

 form_name:"建立採購單",

 sop_url:"https://bridge.com/sop001",

 sop_name:"採購SOP"

}

AI 就可以自己長按鈕

*/




