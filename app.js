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
let lastResultData = [];

// 採購草稿 Workspace
// 一間供應商 = 一張採購單
let purchaseDraft = [];



// ======================================================
// AI Conversation State
// ======================================================
//
// 僅保存聊天流程狀態
//
// 正式採購資料統一放在 purchaseDraft
// conversation 不再保存 purchaseDraft
//
// ======================================================

let conversation = {

    // 目前聊天流程
    step: "",

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
        ${escapeHtml(text)}
        ${time}
    `;

    scrollBottom();
}


// ======================================================
// AI Message UI
// ======================================================

function addAIMessage(
    text,
    buttons = [],
    data = [],
    showData = false,
    allowHtml = false,
    messageClass = ""
) {
    const div = document.createElement("div");

div.className = `ai-message ${messageClass}`;

    div.innerHTML = `

<div class="ai-card">

    <div class="card-header">

        <div class="card-title">
            🤖 Bridge AI
        </div>

    </div>

    <div class="card-body">

${allowHtml ? text : formatMessage(text)}

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

    </div>

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

   console.log("建立 AI 卡片");
console.log("messageClass =", messageClass);
console.log(
    "加入前 AI 卡片數 =",
    messages.querySelectorAll(".ai-message").length
);

messages.appendChild(div);

console.log(
    "加入後 AI 卡片數 =",
    messages.querySelectorAll(".ai-message").length
);

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
                text: "🛒 全部加入採購",
                action: "procurement_all"
            },
            {
                text: "📋 挑選採購商品",
                action: "procurement_select"
            }
        ]
    );

    break;
     case "procurement_select":

    showProductSelect();

    break;       
           case "product_select_next":

    // 儲存本次勾選的商品
    conversation.selectedProducts =
        lastResultData.filter(item => item.selected);
console.log("已選商品：", conversation.selectedProducts);
    handleAction("procurement_all");

    break;

      
case "procurement_all":

    // ==========================================
    // 決定本次採購商品
    // ==========================================

    if (!conversation.selectedProducts) {

        conversation.selectedProducts =
            lastResultData.filter(item => item.selected !== false);

    }

    console.log(
        "本次採購商品：",
        conversation.selectedProducts
    );


    // ==========================================
    // 顯示分析中
    // ==========================================

    addAIMessage("🔍 正在分析商品供應商...");


    // ==========================================
    // 呼叫 Worker
    // ==========================================

    setTimeout(async () => {

        const products =
            conversation.selectedProducts.map(
                item => item["產品編號"]
            );

        console.log(
            "送給 Worker 的產品：",
            products
        );


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


        // ==========================================
        // 建立採購草稿
        // 一間供應商 = 一筆 purchaseDraft
        // ==========================================

        purchaseDraft = result.data.map(group => ({

            ...group,

            deliveryAddress: "",

            requestDate: "",

            remark: ""

        }));


        console.log(
            "===== 採購草稿建立完成 ====="
        );

        console.log(
            "purchaseDraft =",
            purchaseDraft
        );

        console.log(
            "purchaseDraft.length =",
            purchaseDraft.length
        );


        // ==========================================
        // ⭐ 直接顯示採購草稿
        // 一間供應商 = 一張 AI Card
        // ==========================================

        showPurchaseDraft();

    }, 600);

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

    console.log("進入採購草稿編輯");

    addAIMessage(
        "✏️ 請選擇要編輯的採購單"
    );

    purchaseDraft.forEach((group, index) => {

        addAIMessage(
            `🏢 ${group.vendorName}\n📦 共 ${group.items.length} 項商品`,
            [
                {
                    text: "✏️ 編輯此採購單",
                    action: `edit_po_${index}`
                }
            ]
        );

    });

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
// 商品挑選
// ==========================================

function showProductSelect(){
 const oldSelect = document.querySelector(".product-select-message");

    if(oldSelect){
        oldSelect.remove();
    }

    let message = "📋 請選擇要加入採購的商品\n\n";

    // 第一次預設全部勾選
    lastResultData.forEach(item => {

        if(item.selected === undefined){
            item.selected = true;
        }

    });

    const selectedCount =
        lastResultData.filter(item => item.selected).length;

    lastResultData.forEach((item, index) => {

    message += `
    <div class="product-item"
         onclick="toggleProduct(${index})">

        <span class="material-symbols-outlined product-check">
            ${item.selected
                ? "check_circle"
                : "radio_button_unchecked"}
        </span>

        <span class="product-name">
            ${item["商品"]}
        </span>

    </div>
    `;

});

    message += `
        <div class="selected-count">
            已選擇 <strong>${selectedCount}</strong> / ${lastResultData.length} 項商品
        </div>
    `;

    addAIMessage(
        message,
        [
            {
                text:"➡️ 下一步",
                action:"product_select_next"
            }
        ],
        [],
        false,
        true,
         "product-select-message"
    );

}

// ==========================================
// 切換商品勾選
// ==========================================

function toggleProduct(index){

    lastResultData[index].selected =
        !lastResultData[index].selected;

    showProductSelect();

}
// ==========================================
// 顯示採購草稿
// 一間供應商 = 一張採購單
// ==========================================

function showPurchaseDraft() {
console.log("🚨🚨🚨 新版 showPurchaseDraft 被執行了 🚨🚨🚨");
    console.log("purchaseDraft =", purchaseDraft);
    console.log("purchaseDraft.length =", purchaseDraft.length);

    purchaseDraft.forEach((group, index) => {

        console.log("================================");
        console.log("forEach 執行第", index + 1, "次");
        console.log("index =", index);
        console.log("vendorCode =", group.vendorCode);
        console.log("vendorName =", group.vendorName);
        console.log("items =", group.items);

        let message = `
            <div class="purchase-draft">

                <div class="purchase-header">

                    <span class="material-symbols-outlined">
                        business
                    </span>

                    <strong>
                        ${group.vendorName}
                    </strong>

                </div>

                <div class="purchase-info">
                    📦 共 ${group.items.length} 項商品
                </div>

                <div class="purchase-items">
        `;

        group.items.forEach(item => {

            message += `
                <div class="purchase-item">

                    <span class="material-symbols-outlined">
                        inventory_2
                    </span>

                    <span class="product-name">
                        ${item.productName}
                    </span>

                </div>
            `;

        });

        message += `
                </div>

                <button
                    class="purchase-edit-btn"
                    onclick="editPurchaseDraft(${index})">

                    <span class="material-symbols-outlined">
                        edit
                    </span>

                    編輯此採購單

                </button>

            </div>
        `;

        console.log("準備建立第", index + 1, "張 AI 卡片");

        addAIMessage(
            message,
            [],
            [],
            false,
            true
        );

        console.log("第", index + 1, "張 AI 卡片建立完成");

    });

    console.log("===== showPurchaseDraft 結束 =====");
}
// ==========================================
// 編輯指定供應商的採購單
// ==========================================

function editPurchaseDraft(index) {

    const group = purchaseDraft[index];

    console.log("目前編輯的採購單：", group);

    addAIMessage(
        `✏️ 編輯採購單\n\n🏢 ${group.vendorName}\n📦 共 ${group.items.length} 項商品`,
        [
            {
                text: "📝 編輯採購內容",
                action: `edit_po_${index}`
            }
        ]
    );
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

    // ------------------------------
    // 建立中
    // ------------------------------

    addAIMessage("📄 正在建立採購單...");

    console.log("========== Purchase Draft ==========");

    console.log(purchaseDraft);



    try {

        const res = await fetch(API_URL, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                queryType: "create_purchase_order",

                purchaseDraft: purchaseDraft

            })

        });



        const result = await res.json();

        console.log("createPurchaseOrder", result);



        if(result.success){

            conversation.createdPOs = result.createdPOs || [];

            showCreatedPOs();

        }
        else{

            addAIMessage(

                "❌ 建立採購單失敗\n\n" +

                (result.error || "")

            );

        }

    }
    catch(error){

        console.error(error);

        addAIMessage(

            "❌ 無法連線 ERP"

        );

    }

}
// ======================================================
// Purchase Draft Workspace
// 顯示 AI 建立的採購草稿
//
// 一家供應商 = 一張 PO Draft
//
// TODO
// [ ] 修改數量
// [ ] 更換供應商
// [ ] Header Editor
// [ ] Validation
// ======================================================

function showPurchaseDraft() {

    let message = "📦 採購草稿 (Purchase Draft)\n\n";

    purchaseDraft.forEach((group, index) => {

        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        // Header
        message += `🏢 ${group.vendorName}\n`;
        message += `📦 ${group.items.length} 項商品\n\n`;

        // Header 資訊
        message += `📍 交貨地址：${group.deliveryAddress || "未設定"}\n`;
        message += `📅 到貨日期：${group.requestDate || "未設定"}\n`;
        message += `📝 備註：${group.remark || "未設定"}\n\n`;

        message += `-------------------------\n`;

        // 商品
        group.items.forEach(item => {

            message += `☑ ${item.productName}\n`;
            message += `📦 採購數量：${item.minQty}\n`;
            message += `🏢 供應商：${group.vendorName}\n\n`;

        });

    });

    addAIMessage(
        message,
        [
            {
                text: "📍 編輯交貨資訊",
                action: "edit_po_header"
            },
            {
                text: "📦 修改採購數量",
                action: "edit_quantity"
            },
            {
                text: "🏢 更換供應商",
                action: "change_vendor"
            },
            {
                text: "📄 建立全部採購單",
                action: "continue_create_po"
            }
        ]
    );

}
// ======================================================
// 顯示已建立採購單
// ======================================================
//
// AI 已成功建立至 ERP
//
// TODO
// [ ] 查看採購單
// [ ] 編輯採購單
// [ ] 開啟 Ragic
// [ ] 列印採購單
//
// ======================================================

function showCreatedPOs() {

    let message = "✅ 採購單建立完成\n\n";

    conversation.createdPOs.forEach((po, index) => {

        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;

        message += `📄 PO ${index + 1}\n`;

        message += `🏢 ${po.vendorName}\n`;

        message += `🆔 ${po.poNo}\n\n`;

    });

    addAIMessage(
        message,
        [
            {
                text: "📂 查看採購單",
                action: "view_purchase_order"
            },
            {
                text: "🖨️ 列印採購單",
                action: "print_purchase_order"
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
function askDeliveryAddress(){

    console.warn("askDeliveryAddress 已停用");

}
// ======================================================
// AI Agent Framework
//
// Bridge AI 後續所有 AI Agent
//
// Inventory Agent
// Purchase Agent
// Sales Agent
// Warehouse Agent
// Finance Agent
// Report Agent
//
// ======================================================

async function runAgent(action, data){

    console.log("Bridge AI Agent");

    console.log("Action :", action);

    console.log("Data :", data);

}

