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
    messages.appendChild(div);

//scrollBottom();
}
// ========================================
// 編輯指定採購單
// ========================================
async function handleAction(action, url) {
if (action.startsWith("edit_po_")) {

    console.log("🔍 收到編輯 Action：", action);

    const match = action.match(/^edit_po_(\d+)$/);

    if (!match) {

        console.error(
            "❌ 無法解析採購單編號，Action：",
            action
        );

        return;
    }

    const index = parseInt(match[1], 10);

    console.log(
        "🔢 解析出的採購單 Index：",
        index
    );

    const group = purchaseDraft[index];

    if (!group) {

        console.error(
            "❌ 找不到指定採購單：",
            index,
            purchaseDraft
        );

        return;
    }

    conversation.editPurchaseIndex = index;

    console.log(
        "✏️ 選擇編輯採購單：",
        index,
        group
    );

    conversation.step = "edit_menu";

    addAIMessage(
        `✏️ 目前編輯：${group.vendorName}`,
        [
            {
                text: "📍 交貨地址",
                action: "edit_delivery"
            },
            {
                text: "📅 要求到貨日",
                action: "edit_request_date"
            },
            {
                text: "📝 備註",
                action: "edit_remark"
            },
            {
                text: "❌ 返回",
                action: "back_confirm"
            }
        ]
    );

    return;
}


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

    // 將交貨地址寫入所有採購單
    purchaseDraft.forEach(group => {
        group.deliveryAddress = conversation.deliveryAddress;
    });

    conversation.step = "ask_request_date";

    console.log("📍 交貨地址：", conversation.deliveryAddress);
    console.log("📦 更新後採購草稿：", purchaseDraft);

    addAIMessage(
        `📍 交貨地址已設定：${conversation.deliveryAddress}\n\n📅 請問要求到貨日？\n\n例如：2026/08/15`
    );

    break;

case "delivery_taoyuan":

    conversation.deliveryAddress = "桃園物流中心";

    // 將交貨地址寫入所有採購單
    purchaseDraft.forEach(group => {
        group.deliveryAddress = conversation.deliveryAddress;
    });

    conversation.step = "ask_request_date";

    console.log("📍 交貨地址：", conversation.deliveryAddress);
    console.log("📦 更新後採購草稿：", purchaseDraft);

    addAIMessage(
        `📍 交貨地址已設定：${conversation.deliveryAddress}\n\n📅 請問要求到貨日？\n\n例如：2026/08/15`
    );

    break;

case "delivery_other":

    conversation.deliveryAddress = "";

    conversation.step = "input_delivery_address";

  

    addAIMessage("✏️ 請直接輸入交貨地址。");

    break;
            case "confirm_create_po":
             // 建立採購單前先檢查資料
    if (!validatePurchaseDraft()) {
        break;
    }

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

    console.log("✏️ 返回修改目前採購單");

    // 直接進入目前這張採購單的編輯模式
    editPurchaseDraft(0);

    break;


case "finish_edit_purchase":

    console.log("✅ 完成採購單編輯");
    console.log("📦 最終採購資料：", purchaseDraft);

    showPurchaseFinalConfirm();

    break;


case "edit_po_header":

    purchaseDraft.forEach((group, index) => {

        addAIMessage(
            `🏢 ${group.vendorName}\n📦 共 ${group.items.length} 項商品`,
            [
                {
                    text: "📍 編輯交貨資訊",
                    action: `edit_header_${index}`
                }
            ]
        );

    });

    break;
case "edit_current_po":

    console.log("✏️ 返回修改目前採購單");
    console.log("目前採購資料：", purchaseDraft);

     editCurrentPurchaseConfirm();

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

    console.log("purchaseDraft =", purchaseDraft);


    purchaseDraft.forEach((group, index) => {
     let message = `
            <div class="purchase-draft" id="purchase-draft-${index}">

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

                <div class="purchase-header-info">

                    <div>
                        📍 交貨地址：
                        <strong>
                            ${group.deliveryAddress || "未設定"}
                        </strong>
                    </div>

                    <div>
                        📅 要求到貨日：
                        <strong>
                            ${group.requestDate || "未設定"}
                        </strong>
                    </div>

                    <div>
                        📝 備註：
                        <strong>
                            ${group.remark || "未設定"}
                        </strong>
                    </div>

                </div>

                <div class="purchase-items">
        `;

        // ================================
        // 商品
        // ================================

        group.items.forEach(item => {

            message += `
                <div class="purchase-item">

                    <span class="material-symbols-outlined">
                        inventory_2
                    </span>

                    <span class="product-name">
                        ${item.productName}
                    </span>

                    <strong style="margin-left:auto;color:#ff7a00;">
                        × ${item.minQty || 0}
                    </strong>

                </div>
            `;

        });

        // ================================
        // 編輯按鈕
        // ================================

        message += `

                </div>

                <div class="card-footer">

                    <button
                        class="action-btn"
                        onclick="editPurchaseDraft(${index})">

                        <span class="btn-icon">✏️</span>

                        <span>編輯此採購單</span>

                    </button>

                </div>

            </div>
        `;

        

        addAIMessage(
            message,
            [],
            [],
            false,
            true
        );
});  // ← 關閉 forEach

}    // ← 關閉 showPurchaseDraft
// ==========================================
// 編輯指定供應商的採購單
// ==========================================
function editPurchaseDraft(index) {

    const group = purchaseDraft[index];

    console.log("✏️ 編輯第", index + 1, "張採購單");
    console.log("目前資料：", group);

    const card = document.getElementById(`purchase-draft-${index}`);

    if (!card) {
        console.error("找不到採購單卡片：", index);
        return;
    }

    card.innerHTML = `

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

        <!-- ================================= -->
        <!-- 交貨資訊 -->
        <!-- ================================= -->

        <div class="purchase-edit-info">

            <div class="purchase-edit-field">

                <label>📍 交貨地址</label>

                <input
                    type="text"
                    class="purchase-edit-input"
                    id="delivery-address-${index}"
                    value="${group.deliveryAddress || ""}"
                    placeholder="請輸入交貨地址"
                     onkeydown="handlePurchaseEnter(event, ${index}, 'request-date')"
                >

            </div>


            <div class="purchase-edit-field">

                <label>📅 要求到貨日</label>

                <input
                    type="date"
                    class="purchase-edit-input"
                    id="request-date-${index}"
                    value="${group.requestDate || ""}"
                      onkeydown="handlePurchaseEnter(event, ${index}, 'remark')"
                >

            </div>


            <div class="purchase-edit-field">

                <label>📝 備註</label>

                <textarea
                    class="purchase-edit-input purchase-edit-textarea"
                    id="remark-${index}"
                    placeholder="請輸入備註"
                     onkeydown="handlePurchaseEnter(event, ${index}, 'qty-0')"
                >${group.remark || ""}</textarea>

            </div>

        </div>

        <!-- ================================= -->
        <!-- 商品 -->
        <!-- ================================= -->

        <div class="purchase-items">

            ${group.items.map((item, itemIndex) => `

                <div class="purchase-item">

                    <span class="material-symbols-outlined">
                        inventory_2
                    </span>

                    <span class="product-name">
                        ${item.productName}
                    </span>

                </div>


                <div class="purchase-qty-editor">

                    <div class="purchase-qty-label">
                        採購數量
                    </div>

                    <input
                        type="number"
                        min="0"
                        class="purchase-qty-input"
                        id="purchase-qty-${index}-${itemIndex}"
                        value="${item.minQty || 0}"
                        onkeydown="
        handleQtyEnter(
            event,
            ${index},
            ${itemIndex},
            ${group.items.length}
        )
    "
                    >

                </div>

            `).join("")}

        </div>


        <!-- ================================= -->
        <!-- 按鈕 -->
        <!-- ================================= -->

        <div class="card-footer">

            <button
                class="action-btn"
                onclick="savePurchaseDraft(${index})">

                <span class="btn-icon">💾</span>
                <span>儲存修改</span>

            </button>

            <button
                class="action-btn"
                onclick="cancelEditPurchaseDraft(${index})">

                <span class="btn-icon">↩️</span>
                <span>取消編輯</span>

            </button>

        </div>

    `;
}
// ==========================================
// 採購單編輯：Enter 跳到下一個欄位
// ==========================================
function handlePurchaseEnter(event, index, nextField) {

    if (event.key !== "Enter") {
        return;
    }

    // textarea 不讓 Enter 直接換行
    event.preventDefault();

    let nextElement = null;

    if (nextField === "request-date") {

        nextElement =
            document.getElementById(`request-date-${index}`);

    }

    else if (nextField === "remark") {

        nextElement =
            document.getElementById(`remark-${index}`);

    }

    else if (nextField.startsWith("qty-")) {

        const itemIndex =
            Number(nextField.replace("qty-", ""));

        nextElement =
            document.getElementById(
                `purchase-qty-${index}-${itemIndex}`
            );

    }

    if (nextElement) {

        nextElement.focus();

        // 日期欄位如果需要，可以讓游標直接進入
        if (
            nextElement.tagName === "INPUT" &&
            nextElement.type !== "date"
        ) {
            nextElement.select();
        }

    }
}
// ==========================================
// 採購數量：Enter 跳下一個商品
// ==========================================
function handleQtyEnter(event, index, itemIndex, totalItems) {

    if (event.key !== "Enter") {
        return;
    }

    event.preventDefault();

    // 還有下一個商品
    if (itemIndex + 1 < totalItems) {

        const nextInput =
            document.getElementById(
                `purchase-qty-${index}-${itemIndex + 1}`
            );

        if (nextInput) {
            nextInput.focus();
            nextInput.select();
        }

    }

    // 最後一個商品
    else {

        const saveButton =
            document.querySelector(
                `#purchase-draft-${index} .card-footer .action-btn`
            );

        if (saveButton) {
            saveButton.focus();
        }

    }
}
// ==========================================
// 儲存指定採購單修改
// ==========================================
function savePurchaseDraft(index) {

    const group = purchaseDraft[index];

    console.log("💾 儲存第", index + 1, "張採購單");
    console.log("儲存前資料：", group);


    // ==========================================
    // 儲存交貨資訊
    // ==========================================

    const deliveryInput =
        document.getElementById(`delivery-address-${index}`);

    const requestDateInput =
        document.getElementById(`request-date-${index}`);

    const remarkInput =
        document.getElementById(`remark-${index}`);


    if (deliveryInput) {
        group.deliveryAddress = deliveryInput.value.trim();
    }

    if (requestDateInput) {
        group.requestDate = requestDateInput.value;
    }

    if (remarkInput) {
        group.remark = remarkInput.value.trim();
    }
// ==========================================
// 儲存前必填檢查
// ==========================================

// ① 交貨地址：必填
if (!deliveryInput || !deliveryInput.value.trim()) {

    alert("⚠️ 請填寫交貨地址");

    if (deliveryInput) {
        deliveryInput.focus();
    }

    return;
}


// ② 要求到貨日：非必填
// 不需要檢查


// ③ 商品採購數量：每一項都必填，而且必須 > 0

for (let itemIndex = 0; itemIndex < group.items.length; itemIndex++) {

    const input = document.getElementById(
        `purchase-qty-${index}-${itemIndex}`
    );

    if (!input) {

        console.warn(
            "找不到採購數量輸入框：",
            index,
            itemIndex
        );

        return;
    }

    const qty = Number(input.value);

    if (!input.value.trim() || isNaN(qty) || qty <= 0) {

        alert(
            `⚠️ 請填寫「${group.items[itemIndex].productName}」的採購數量，且數量必須大於 0`
        );

        input.focus();
        input.select();

        return;
    }
}


// ④ 備註：非必填
// 不需要檢查

    // ==========================================
    // 儲存商品數量
    // ==========================================

    group.items.forEach((item, itemIndex) => {

        const input = document.getElementById(
            `purchase-qty-${index}-${itemIndex}`
        );

        if (!input) {
            console.warn(
                "找不到採購數量輸入框：",
                index,
                itemIndex
            );
            return;
        }

        let qty = Number(input.value);

        if (isNaN(qty) || qty < 0) {
            qty = 0;
        }

        item.minQty = qty;

    });


    console.log("💾 儲存後資料：", group);

    console.log("📍 交貨地址：", group.deliveryAddress);
    console.log("📅 要求到貨日：", group.requestDate);
    console.log("📝 備註：", group.remark);
    console.log("📦 商品資料：");

group.items.forEach((item, itemIndex) => {

    console.log(
        `商品 ${itemIndex + 1}：`,
        {
            productCode: item.productCode,
            productName: item.productName,
            price: item.price,
            minQty: item.minQty
        }
    );

});


    // ==========================================
    // 重新顯示這一張採購單
    // ==========================================

  renderPurchaseDraft(index);

// ==========================================
// 顯示「完成編輯」按鈕
// ==========================================

addAIMessage(
    "如果已完成所有採購單的修改，請點擊下方按鈕。",
    [
        {
            text: "✅ 完成編輯",
            action: "finish_edit_purchase"
        }
    ]
);

} // ← savePurchaseDraft() 到這裡才結束
// ==========================================
// 顯示指定採購單
// ==========================================
function renderPurchaseDraft(index) {

    const group = purchaseDraft[index];

    console.log("🔄 重新顯示第", index + 1, "張採購單");
    console.log("目前資料：", group);

    const card = document.getElementById(`purchase-draft-${index}`);

    if (!card) {
        console.error("找不到採購單卡片：", index);
        return;
    }

    card.innerHTML = `

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

        <!-- 採購單資訊 -->
        <div class="purchase-meta">

            <div class="purchase-meta-row">
                <span>📍 交貨地址</span>
                <strong>
                    ${group.deliveryAddress || "未設定"}
                </strong>
            </div>

            <div class="purchase-meta-row">
                <span>📅 要求到貨日</span>
                <strong>
                    ${group.requestDate || "未設定"}
                </strong>
            </div>

            <div class="purchase-meta-row">
                <span>📝 備註</span>
                <strong>
                    ${group.remark || "未設定"}
                </strong>
            </div>

        </div>

        <div class="purchase-items">

            ${group.items.map(item => `

                <div class="purchase-item">

                    <span class="material-symbols-outlined">
                        inventory_2
                    </span>

                    <span class="product-name">
                        ${item.productName}
                    </span>

                    <span class="purchase-qty">
                        × ${item.minQty || 0}
                    </span>

                </div>

            `).join("")}

        </div>

        <div class="card-footer">

            <button
                class="action-btn"
                onclick="editPurchaseDraft(${index})">

                <span class="btn-icon">✏️</span>
                <span>編輯此採購單</span>

            </button>

        </div>

    `;
}
// ========================================
// 詢問交貨地址
// ========================================

function askDeliveryAddress() {

    conversation.step = "ask_delivery_address";

    addAIMessage(
        "📍 請選擇交貨地址",
        [
            {
                text: "🏢 台北總公司",
                action: "delivery_taipei"
            },
            {
                text: "🚚 桃園物流中心",
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
// 顯示採購單最終確認
// ==========================================
function showPurchaseFinalConfirm() {

    console.log("📋 顯示採購單最終確認");
    console.log("目前採購資料：", purchaseDraft);

    let message = `
        <div class="purchase-final-confirm">

            <div class="purchase-confirm-title">
                📋 採購單確認
            </div>
    `;

    purchaseDraft.forEach((group, index) => {

        message += `
            <div class="purchase-confirm-vendor">

                <div class="purchase-confirm-vendor-name">
                    🏢 ${group.vendorName}
                </div>

                <div class="purchase-confirm-info">
                    📍 交貨地址：
                    <strong>${group.deliveryAddress || "未填寫"}</strong>
                </div>

                <div class="purchase-confirm-info">
                    📅 要求到貨日：
                    <strong>${group.requestDate || "未填寫"}</strong>
                </div>

                <div class="purchase-confirm-info">
                    📝 備註：
                    <strong>${group.remark || "無"}</strong>
                </div>

                <div class="purchase-confirm-items">
        `;

        group.items.forEach(item => {

            message += `
                <div class="purchase-confirm-item">

                    <div>
                        📦 ${item.productName}
                    </div>

                    <div>
                        數量：
                        <strong>${item.minQty}</strong>
                    </div>

                    <div>
                        單價：
                        <strong>$${item.price || 0}</strong>
                    </div>

                </div>
            `;

        });

        message += `
                </div>

            </div>
        `;

    });

    message += `
        </div>
    `;

    addAIMessage(
        message,
        [
            {
                text: "✅ 確認建立採購單",
                action: "confirm_create_po"
            },
            {
                text: "✏️ 返回修改",
                action: "edit_current_po"
            }
        ],
        [],
        false,
        true,
    "purchase-final-message"
    );
}
// ==========================================
// 將目前「採購單最終確認」切換成編輯模式
// 不新增 AI 訊息
// ==========================================
function editCurrentPurchaseConfirm() {

    console.log("✏️ 進入目前採購單編輯模式");
    console.log("目前採購資料：", purchaseDraft);

    // 找到最後一張「採購單最終確認」訊息
    const messagesList = document.querySelectorAll(
        ".ai-message.purchase-final-message"
    );

    if (!messagesList.length) {

        console.error("❌ 找不到採購單最終確認訊息");
        return;

    }

    const messageDiv = messagesList[messagesList.length - 1];

    const cardBody = messageDiv.querySelector(".card-body");
    const cardFooter = messageDiv.querySelector(".card-footer");

    if (!cardBody || !cardFooter) {

        console.error("❌ 找不到採購單確認內容區域");
        return;

    }

    // ==========================================
    // 目前先編輯第 1 張採購單
    // ==========================================

    const index = 0;
    const group = purchaseDraft[index];

    if (!group) {

        console.error("❌ 找不到目前採購單資料");
        return;

    }

    console.log("✏️ 編輯第", index + 1, "張採購單");
    console.log("目前資料：", group);


    // ==========================================
    // 直接把「確認內容」改成「編輯內容」
    // ==========================================

    cardBody.innerHTML = `

        <div class="purchase-final-confirm">

            <div class="purchase-confirm-title">
                ✏️ 編輯採購單
            </div>


            <div class="purchase-edit-info">

                <div class="purchase-edit-field">

                    <label>🏢 供應商</label>

                    <strong>
                        ${group.vendorName}
                    </strong>

                </div>


                <div class="purchase-edit-field">

                    <label>📍 交貨地址</label>

                    <input
                        type="text"
                        class="purchase-edit-input"
                        id="delivery-address-${index}"
                        value="${group.deliveryAddress || ""}"
                        placeholder="請輸入交貨地址"
                    >

                </div>


                <div class="purchase-edit-field">

                    <label>📅 要求到貨日</label>

                    <input
                        type="date"
                        class="purchase-edit-input"
                        id="request-date-${index}"
                        value="${group.requestDate || ""}"
                    >

                </div>


                <div class="purchase-edit-field">

                    <label>📝 備註</label>

                    <textarea
                        class="purchase-edit-input purchase-edit-textarea"
                        id="remark-${index}"
                        placeholder="請輸入備註"
                    >${group.remark || ""}</textarea>

                </div>

            </div>


            <div class="purchase-items">

                ${group.items.map((item, itemIndex) => `

                    <div class="purchase-item">

                        <span class="material-symbols-outlined">
                            inventory_2
                        </span>

                        <span class="product-name">
                            ${item.productName}
                        </span>

                    </div>


                    <div class="purchase-qty-editor">

                        <div class="purchase-qty-label">
                            採購數量
                        </div>

                        <input
                            type="number"
                            min="0"
                            class="purchase-qty-input"
                            id="purchase-qty-${index}-${itemIndex}"
                            value="${item.minQty || 0}"
                        >

                    </div>

                `).join("")}

            </div>

        </div>

    `;


    // ==========================================
    // 修改原本按鈕
    // ==========================================

    cardFooter.innerHTML = `

        <button
            class="action-btn primary"
            onclick="savePurchaseDraft(${index})">

            <span class="btn-icon">💾</span>
            <span>儲存修改</span>

        </button>

        <button
            class="action-btn"
            onclick="cancelEditPurchaseConfirm()">

            <span class="btn-icon">↩️</span>
            <span>取消編輯</span>

        </button>

    `;

}
// ==========================================
// 採購單建立前：資料完整性檢查
// ==========================================
function validatePurchaseDraft() {

    console.log("🔍 開始檢查採購資料");
    console.log("📦 採購草稿：", purchaseDraft);

    const errors = [];

    purchaseDraft.forEach((group, groupIndex) => {

        // ------------------------------
        // 交貨地址：必填
        // ------------------------------
        if (!group.deliveryAddress || !group.deliveryAddress.trim()) {

            errors.push(
                `🏢 ${group.vendorName}：未填寫交貨地址`
            );

        }

        // ------------------------------
        // 商品採購數量：必填且 > 0
        // ------------------------------
        if (!group.items || group.items.length === 0) {

            errors.push(
                `🏢 ${group.vendorName}：沒有採購商品`
            );

            return;
        }

        group.items.forEach((item, itemIndex) => {

            const qty = Number(item.minQty);

            if (!item.minQty || isNaN(qty) || qty <= 0) {

                errors.push(
                    `🏢 ${group.vendorName}／📦 ${item.productName}：採購數量必須大於 0`
                );

            }

        });

    });


    // ==========================================
    // 有錯誤
    // ==========================================

    if (errors.length > 0) {

        console.warn("❌ 採購資料檢查失敗");
        console.warn(errors);

        let message =
            "⚠️ 採購單尚有資料未完成\n\n";

        errors.forEach((error, index) => {

            message += `${index + 1}. ${error}\n`;

        });

        message +=
            "\n請返回修改後，再重新確認。";


        addAIMessage(
            message,
            [
                {
                    text: "✏️ 返回修改",
                    action: "edit_purchase_draft"
                }
            ]
        );

        return false;
    }


    // ==========================================
    // 全部通過
    // ==========================================

    console.log("✅ 採購資料檢查通過");

    return true;
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

