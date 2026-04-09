pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// ==========================================
// ✅ PRESERVED KEYS (Turn 15, Line 5-7)
// ==========================================
const CLIENT_ID = '1099442490417-04i1f2t2ilj31ddki1c4fhcm3bgdr2j6.apps.googleusercontent.com';
const API_KEY = 'AIzaSyC657KGTX-fn3TxdYptSIedkQ0ZKd4lfUI';
const ADMIN_FOLDER_ID = '10pTgGbmUDlOvbUuJDYuIrBy3svSif2-s';
// ==========================================

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let tokenClient;
let accessToken = null;
let currentOriginalText = "";
let timerInterval, timeLeft = 900, started = false;
let studentResults = JSON.parse(localStorage.getItem('localResults')) || [];

// 1. Google Login Auth
window.onload = function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            accessToken = tokenResponse.access_token;
            // Login Success!
            document.getElementById('home-page').style.display = 'none';
            document.getElementById('dashboard-page').style.display = 'flex';
        },
    });
};

function handleGoogleLogin() {
    tokenClient.requestAccessToken();
}

// 2. Modified: Toggle and Populate Inline Test List
async function toggleTestList() {
    const listDiv = document.getElementById('inline-test-list');
    const button = document.querySelector('.action-card button');
    
    // Toggle behavior
    if (listDiv.style.display === 'block') {
        listDiv.style.display = 'none';
        button.innerText = "View My Tests";
        return;
    }
    
    // Otherwise show and load
    listDiv.style.display = 'block';
    button.innerText = "Hide My Tests";
    
    listDiv.innerHTML = '<span style="color:#64748b;">Loading tests from Admin Drive...</span>';

    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${ADMIN_FOLDER_ID}'+in+parents&key=${API_KEY}`);
        const data = await response.json();
        
        if (data.files && data.files.length > 0) {
            listDiv.innerHTML = data.files.map(file => `
                <div class="test-list-row" onclick="startTest('${file.id}', '${file.name}')">
                    <span>${file.name}</span>
                    <span class="test-row-id">Admin</span>
                </div>
            `).join('');
        } else {
            listDiv.innerHTML = '<span style="color:#ef4444;">No tests available.</span>';
        }
    } catch (error) {
        listDiv.innerHTML = '<span style="color:#ef4444;">Error loading tests. Check Config.</span>';
    }
}

// 3. Load Selected Test PDF (Page 3 workspace)
async function startTest(fileId, fileName) {
    document.getElementById('dashboard-page').style.display = 'none';
    document.getElementById('workspace-page').style.display = 'flex';
    document.getElementById('current-test-name').innerText = `Admin Test: ${fileName}`;
    
    const pdfContainer = document.getElementById('pdf-container');
    pdfContainer.innerHTML = '<div class="empty-state">Loading PDF from Drive...</div>';
    
    // Reset Editor & Timer
    document.getElementById('editor').innerHTML = "";
    clearInterval(timerInterval);
    timeLeft = 900; started = false;
    document.getElementById('timer').innerText = "15:00";

    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        const arrayBuffer = await response.arrayBuffer();
        const typedarray = new Uint8Array(arrayBuffer);

        const pdf = await pdfjsLib.getDocument({
            data: typedarray,
            standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/standard_fonts/'
        }).promise;

        pdfContainer.innerHTML = '';
        currentOriginalText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({scale: 2.2});
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            canvas.height = viewport.height; canvas.width = viewport.width;
            await page.render({canvasContext: canvas.getContext('2d'), viewport, intent: 'print'}).promise;
            
            const wrap = document.createElement('div');
            wrap.className = 'pdf-wrap';
            wrap.appendChild(canvas);
            pdfContainer.appendChild(wrap);
            
            const content = await page.getTextContent();
            currentOriginalText += content.items.map(s => s.str).join(" ") + " ";
        }
    } catch (err) {
        pdfContainer.innerHTML = '<div class="empty-state" style="color:red;">Failed to load PDF. Check Drive Permissions.</div>';
    }
}

// 4. Submit & Compare Result
document.getElementById('submit-btn').onclick = () => {
    if(!started) return alert("You haven't typed anything yet!");
    clearInterval(timerInterval);
    
    const typedWords = document.getElementById('editor').innerText.trim().split(/\s+/);
    const refWords = currentOriginalText.trim().split(/\s+/);
    let mistakes = 0, html = "";
    
    refWords.forEach((word, i) => {
        if(typedWords[i] === word) html += `<span class="text-correct">${word}</span> `;
        else { mistakes++; html += `<span class="text-error">${word || '___'}</span> `; }
    });

    const timeSpent = (900 - timeLeft) / 60;
    const wpm = Math.round((typedWords.length / 5) / (timeSpent || 1));
    const acc = ((refWords.length - mistakes) / refWords.length * 100).toFixed(1) + "%";

    document.getElementById('res-wpm').innerText = wpm;
    document.getElementById('res-acc').innerText = acc;
    document.getElementById('error-analysis').innerHTML = html;
    document.getElementById('result-modal').style.display = 'flex';

    studentResults.push({ date: new Date().toLocaleDateString(), testName: document.getElementById('current-test-name').innerText, wpm, acc });
    localStorage.setItem('localResults', JSON.stringify(studentResults));
};

// 5. Utilities
document.getElementById('editor').oninput = () => {
    if(!started && currentOriginalText) {
        started = true;
        timerInterval = setInterval(() => {
            timeLeft--;
            let m = Math.floor(timeLeft / 60);
            let s = timeLeft % 60;
            document.getElementById('timer').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        }, 1000);
    }
};

document.querySelectorAll('.t-btn').forEach(btn => {
    btn.onclick = () => { document.execCommand(btn.dataset.cmd, false, null); document.getElementById('editor').focus(); };
});

function backToDashboard() {
    document.getElementById('result-modal').style.display = 'none';
    document.getElementById('workspace-page').style.display = 'none';
    document.getElementById('dashboard-page').style.display = 'flex';
}

function showHistory() {
    document.getElementById('history-modal').style.display = 'flex';
    const tbody = document.getElementById('history-body');
    if(studentResults.length === 0) { tbody.innerHTML = '<tr><td colspan="4">No tests taken yet.</td></tr>'; return; }
    tbody.innerHTML = studentResults.map(r => `<tr><td>${r.date}</td><td>${r.testName}</td><td>${r.wpm}</td><td>${r.acc}</td></tr>`).reverse().join('');
}
