// ==========================================
// Bridge AI V2
// ==========================================

// Cloudflare Worker API
const API_URL = "https://bridge-ai-api.yosheng96750043.workers.dev/";

// 暫存最近一次 AI 查詢回傳的 ERP 資料
let lastResultData = [];
// 採購草稿
let purchaseDraft = [];
// ===========================
// AI 對話狀態
// ===========================
let conversation = {

    step: "",

    purchaseDraft: [],

    deliveryAddress: "",

    supplierAddress: "",

    requestDate: "",

    remark: ""

};
// DOM
const chat = document.getElementById("chat");
const messages = document.getElementById("messages");
const welcome = document.getElementById("welcome");

const input = document.getElementById("question");
const sendButton = document.getElementById("send");

const quickButtons = document.querySelectorAll(".quick-btn");

// 是否已開始聊天
let started = false;

// ------------------------------
// 事件
// ------------------------------

sendButton.addEventListener("click", sendMessage);

input.addEventListener("keydown", function (e) {

    if (e.key === "Enter") {

        sendMessage();

    }

});

// 快速提問

quickButtons.forEach(function (button) {

    button.addEventListener("click", function () {

        input.value = button.dataset.question;

        sendMessage();

    });

});

// ------------------------------
// 送出訊息
// ------------------------------

async function sendMessage() {

    const question = input.value.trim();

    if (question === "") return;

    if (!started) {

        started = true;

        welcome.style.display = "none";

    }

    addUserMessage(question);

    input.value = "";

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
        // 暫存 ERP 查詢結果，供後續按鈕使用
lastResultData = result.data || [];
     const icon = result.icon || "";
const category = result.category || "";
const answer = result.answer || "";
        loading.remove();

if (result.success) {

    //const message = `${icon} ${category}

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

    } catch (e) {

        loading.remove();

        addAIMessage("無法連線 Cloudflare Worker");

    }

}
// ==========================================
// 使用者訊息
// ==========================================

function addUserMessage(text) {

    const now = new Date();

    const time =
        now.getHours().toString().padStart(2, "0") +
        ":" +
        now.getMinutes().toString().padStart(2, "0");

    const div = document.createElement("div");

    div.className = "user-message";

    div.innerHTML = `

<div class="user-wrapper">

    <div class="user-bubble">

        ${escapeHtml(text)}

    </div>

    <div class="message-time">

        ${time}

    </div>

</div>

`;

    messages.appendChild(div);

    scrollBottom();

}



// ==========================================
// AI訊息
// ==========================================

function addAIMessage(text, buttons = [], data = [], showData = false) {
    const div = document.createElement("div");

    div.className = "ai-message";

  div.innerHTML = `

<div class="ai-card">

    <div class="card-header">

        <div class="card-title">

            🤖 Bridge AI

        </div>

    </div>

    <div class="card-body">

        ${formatMessage(text)}

    </div>
    ${showData && data.length ? `

<div class="erp-list">

${data.map(item => `

<div class="erp-card">

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

</div>

`).join("")}
</div>

` : ""}

${buttons.length ? `

<div class="card-footer">

    ${buttons.map(button => `

    <button
    class="action-btn ${button.color || "primary"}"
    onclick="handleAction('${button.action}','${button.url || ""}')">

    <span class="btn-icon">${button.icon || ""}</span>
    <span>${button.text}</span>

</button>

    `).join("")}

</div>

` : ""}

</div>

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
purchaseDraft = result.data;
console.log("採購草稿：", purchaseDraft);
const groups = result.data;

let message = "📊 已分析完成。\n\n";

groups.forEach(group => {

    message += "━━━━━━━━━━━━━━\n\n";

    message += `🏢 ${group.vendorName}\n\n`;

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
            text: "📄 建立採購單",
            action: "create_po"
        },
        {
            text: "✏️ 自行調整",
            action: "adjust_vendor"
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
