// ==========================================
// Bridge AI V2
// ==========================================

// Cloudflare Worker API
const API_URL = "https://bridge-ai-api.yosheng96750043.workers.dev/";

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
      const answer = result.answer;

const button = result.button;

const icon = result.icon;

const category = result.category;

        loading.remove();

        if (result.success) {

            addAIMessage(result.answer);

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

    const div = document.createElement("div");

    div.className = "user-message";

    div.innerHTML = `

        <div class="bubble user-bubble">

            ${escapeHtml(text)}

        </div>

    `;

    messages.appendChild(div);

    scrollBottom();

}



// ==========================================
// AI訊息
// ==========================================

function addAIMessage(text) {

    const div = document.createElement("div");

    div.className = "ai-message";

    div.innerHTML = `

        <div class="bubble ai-bubble">

            ${formatMessage(text)}

        </div>

    `;

    messages.appendChild(div);

    scrollBottom();

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

function createActionButton(text,url){

    const button=document.createElement("button");

    button.className="action-btn";

    button.innerHTML=text;

    button.onclick=function(){

        window.open(url,"_blank");

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
