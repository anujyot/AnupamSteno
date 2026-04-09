pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

const CLIENT_ID = '1099442490417-04i1f2t2ilj31ddki1c4fhcm3bgdr2j6.apps.googleusercontent.com';
const API_KEY = 'AIzaSyC657KGTX-fn3TxdYptSIedkQ0ZKd4lfUI';
const ADMIN_FOLDER_ID = '10pTgGbmUDlOvbUuJDYuIrBy3svSif2-s';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let tokenClient, accessToken = null, currentOriginalText = "", currentTestName = "", timerInterval, timeLeft = 900, started = false;

window.onload = function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES,
        callback: (res) => { accessToken = res.access_token; document.getElementById('home-page').style.display = 'none'; document.getElementById('dashboard-page').style.display = 'flex'; }
    });
};

function handleGoogleLogin() { tokenClient.requestAccessToken(); }

function changeFontSize(type) {
    const ed = document.getElementById('editor');
    let size = parseInt(window.getComputedStyle(ed).fontSize);
    ed.style.fontSize = (type === 'inc' ? size + 2 : size - 2) + 'px';
}

async function toggleTestList() {
    const list = document.getElementById('inline-test-list');
    list.style.display = list.style.display === 'flex' ? 'none' : 'flex';
    list.innerHTML = 'Loading tests...';
    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${ADMIN_FOLDER_ID}'+in+parents&key=${API_KEY}`);
        const data = await res.json();
        list.innerHTML = data.files.map(f => `<div class="test-box" style="border:1px solid #1e293b; padding:10px; cursor:pointer; font-weight:bold; margin:5px; background:white;" onclick="startTest('${f.id}', '${f.name}')">${f.name.replace('.pdf','')}</div>`).join('');
    } catch(e) { list.innerHTML = "Error loading files."; }
}

async function startTest(id, name) {
    currentTestName = name.replace('.pdf','');
    document.getElementById('dashboard-page').style.display = 'none';
    document.getElementById('workspace-page').style.display = 'flex';
    const container = document.getElementById('pdf-container');
    container.innerHTML = 'Loading HD PDF...';
    
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${API_KEY}`);
    const pdf = await pdfjsLib.getDocument({data: await res.arrayBuffer()}).promise;
    container.innerHTML = ''; currentOriginalText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({scale: 4.0}); // HD QUALITY
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.height = viewport.height; canvas.width = viewport.width;
        await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
        const wrap = document.createElement('div'); wrap.className = 'pdf-wrap';
        wrap.appendChild(canvas); container.appendChild(wrap);
        const text = await page.getTextContent();
        // Maintain layout during text extraction
        currentOriginalText += text.items.map(s => s.str).join(" ") + "\n";
    }
}

function beginTypingTest() {
    started = true; const ed = document.getElementById('editor');
    ed.contentEditable = true; ed.innerHTML = ""; ed.focus();
    document.getElementById('start-test-btn').innerText = currentTestName;
    timerInterval = setInterval(() => {
        timeLeft--;
        let m = Math.floor(timeLeft/60), s = timeLeft%60;
        document.getElementById('timer').innerText = `${m}:${s<10?'0':''}${s}`;
        if(timeLeft <= 0) document.getElementById('submit-btn').click();
    }, 1000);
}

document.getElementById('submit-btn').onclick = () => {
    if(!started) return;
    clearInterval(timerInterval);
    
    const editor = document.getElementById('editor');
    const typedText = editor.innerText;
    const typedWords = typedText.trim().split(/\s+/);
    const refWords = currentOriginalText.trim().split(/\s+/);
    
    let mistakes = 0;
    let html = "";

    // Exact word matching for legal accuracy
    refWords.forEach((ref, i) => {
        let typed = typedWords[i] || "";
        
        // Exact match or Case-insensitive match or Formatting (Colon etc.)
        if (typed === ref || typed.toLowerCase() === ref.toLowerCase() || (ref.endsWith(':') && typed === ref.replace(':',''))) {
            html += `<span class="text-correct">${ref}</span> `;
        } else if (typed === "") {
            mistakes++;
            html += `<span class="text-missing">${ref}</span> `; // Underline Green
        } else {
            mistakes++;
            html += `<span class="text-error">${typed}</span><span class="text-correct">(${ref})</span> `; // Red
        }
    });

    // Horizontal Line Check
    if(!editor.innerHTML.includes('<hr>')) {
        html = '<div class="hr-mistake"></div>' + html;
    }

    const wpm = Math.round((typedWords.length/5)/((900-timeLeft)/60)) || 0;
    document.getElementById('res-wpm').innerText = wpm;
    document.getElementById('res-acc').innerText = ((refWords.length-mistakes)/refWords.length*100).toFixed(1) + "%";
    document.getElementById('error-analysis').innerHTML = html;
    document.getElementById('result-modal').style.display = 'flex';
};

function backToDashboard() { location.reload(); }
document.querySelectorAll('.t-btn').forEach(b => {
    if(b.dataset.cmd) b.onclick = () => { document.execCommand(b.dataset.cmd); document.getElementById('editor').focus(); };
});
