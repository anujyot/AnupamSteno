pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// =========================================================
// ✅ AAPKI FINAL KEYS (Maine correct format me set kar di hain)
// =========================================================
const CLIENT_ID = '1099442490417-04i1f2t2ilj31ddki1c4fhcm3bgdr2j6.apps.googleusercontent.com';
const API_KEY = 'AIzaSyC657KGTX-fn3TxdYptSIedkQ0ZKd4lfUI';
const ADMIN_FOLDER_ID = '10pTgGbmUDlOvbUuJDYuIrBy3svSif2-s';
// =========================================================

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let tokenClient;
let accessToken = null;
let currentOriginalText = "";
let currentTestName = "";
let timerInterval, timeLeft = 900, started = false;
let studentResults = JSON.parse(localStorage.getItem('localResults')) || [];

// 1. Google Login Auth
window.onload = function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            accessToken = tokenResponse.access_token;
            document.getElementById('home-page').style.display = 'none';
            document.getElementById('dashboard-page').style.display = 'flex';
        },
    });
};

function handleGoogleLogin() {
    tokenClient.requestAccessToken();
}

// 2. Fetch Test List from Admin's Folder
async function toggleTestList() {
    const listDiv = document.getElementById('inline-test-list');
    
    if (listDiv.style.display === 'flex') {
        listDiv.style.display = 'none';
        return;
    }
    
    listDiv.style.display = 'flex';
    listDiv.innerHTML = '<span style="color: #64748b;">Loading files...</span>';

    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files?q='${ADMIN_FOLDER_ID}'+in+parents&key=${API_KEY}`);
        const data = await response.json();
        
        if (data.files && data.files.length > 0) {
            // Test 1, Test 2 Boxes generate honge
            listDiv.innerHTML = data.files.map(file => `
                <div class="test-box" onclick="startTest('${file.id}', '${file.name}')">
                    ${file.name.replace('.pdf', '')}
                </div>
            `).join('');
        } else {
            listDiv.innerHTML = '<span style="color: #ef4444;">No tests uploaded yet.</span>';
        }
    } catch (error) {
        listDiv.innerHTML = '<span style="color: #ef4444;">Access Error. Check Folder sharing permissions.</span>';
    }
}

// 3. Load PDF into Workspace
async function startTest(fileId, fileName) {
    document.getElementById('dashboard-page').style.display = 'none';
    document.getElementById('workspace-page').style.display = 'flex';
    
    currentTestName = fileName.replace('.pdf', '');
    document.getElementById('current-test-name').innerText = currentTestName;
    
    const pdfContainer = document.getElementById('pdf-container');
    pdfContainer.innerHTML = '<div class="empty-state">Downloading Test Paper...</div>';
    
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
        pdfContainer.innerHTML = '<div class="empty-state" style="color:var(--danger);">Error loading PDF file.</div>';
    }
}

// 4. Compare Result & Save Data
document.getElementById('submit-btn').onclick = () => {
    if(!started) return alert("You haven't typed anything!");
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

    // Results Backup
    const resultData = {
        date: new Date().toLocaleDateString(),
        testName: currentTestName,
        wpm: wpm,
        accuracy: acc
    };
    studentResults.push(resultData);
    localStorage.setItem('localResults', JSON.stringify(studentResults));
    saveToStudentDrive(resultData); // Save JSON to Google Drive
};

async function saveToStudentDrive(dataObj) {
    const fileContent = new Blob([JSON.stringify(dataObj, null, 2)], { type: 'application/json' });
    const metadata = { name: `AnupamSteno_${dataObj.testName}_Result.json` };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', fileContent);
    fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: new Headers({ 'Authorization': `Bearer ${accessToken}` }),
        body: form
    });
}

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
    document.getElementById('history-page').style.display = 'flex';
    const tbody = document.getElementById('history-body');
    if(studentResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">No tests completed yet.</td></tr>';
        return;
    }
    tbody.innerHTML = studentResults.map(r => `
        <tr><td>${r.date}</td><td style="font-weight:bold;">${r.testName}</td><td style="color:var(--accent); font-weight:bold;">${r.wpm}</td><td style="color:#10b981; font-weight:bold;">${r.accuracy}</td></tr>
    `).reverse().join('');
}
