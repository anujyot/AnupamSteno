pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// =========================================================
// ✅ AAPKI FINAL KEYS
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

// 1. Google Login Setup
window.onload = function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse && tokenResponse.access_token) {
                accessToken = tokenResponse.access_token;
                document.getElementById('home-page').style.display = 'none';
                document.getElementById('dashboard-page').style.display = 'flex';
            }
        },
    });
};

function handleGoogleLogin() {
    try {
        tokenClient.requestAccessToken();
    } catch(e) {
        alert("Google script is loading, please wait 2 seconds and click again.");
    }
}

// 2. Fetch Tests List
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

// 3. Load PDF & Setup Start Button
async function startTest(fileId, fileName) {
    document.getElementById('dashboard-page').style.display = 'none';
    document.getElementById('workspace-page').style.display = 'flex';
    
    currentTestName = fileName.replace('.pdf', '');
    
    // Reset "Start Test" Button
    const startBtn = document.getElementById('start-test-btn');
    startBtn.innerText = "Start Test";
    startBtn.style.background = "#10b981";
    startBtn.setAttribute("onclick", "beginTypingTest()");
    
    // Lock the editor
    const editor = document.getElementById('editor');
    editor.contentEditable = false;
    editor.innerHTML = "<div style='color:#94a3b8; text-align:center; margin-top:100px; font-weight:bold;'>Click the Green 'Start Test' button above to begin typing...</div>";
    
    const pdfContainer = document.getElementById('pdf-container');
    pdfContainer.innerHTML = '<div class="empty-state">Downloading Test Paper...</div>';
    
    clearInterval(timerInterval);
    timeLeft = 900; started = false;
    document.getElementById('timer').innerText = "15:00";

    try {
        // Fetch public PDF using API key
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${API_KEY}`);
        if (!response.ok) throw new Error("File access denied.");
        
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
        console.error(err);
        pdfContainer.innerHTML = '<div class="empty-state" style="color:var(--danger);">Error loading PDF file. Please ensure the PDF file inside Google Drive is shared as "Anyone with the link".</div>';
    }
}

// 4. Begin Typing Logic (Unlocks editor, starts timer)
function beginTypingTest() {
    if (!currentOriginalText) {
        alert("Please wait for the PDF to load completely before starting!");
        return;
    }
    
    started = true;
    
    // Unlock editor
    const editor = document.getElementById('editor');
    editor.contentEditable = true;
    editor.innerHTML = ""; 
    editor.focus();

    // Change Button appearance
    const startBtn = document.getElementById('start-test-btn');
    startBtn.innerText = currentTestName;
    startBtn.style.background = "#334155";
    startBtn.removeAttribute("onclick"); // Disable clicking again

    // Timer Logic
    timerInterval = setInterval(() => {
        timeLeft--;
        let m = Math.floor(timeLeft / 60);
        let s = timeLeft % 60;
        document.getElementById('timer').innerText = `${m}:${s < 10 ? '0' : ''}${s}`;
        
        if(timeLeft <= 0) {
            clearInterval(timerInterval);
            alert("Time is up! Submitting your test automatically.");
            document.getElementById('submit-btn').click();
        }
    }, 1000);
}

// 5. Submit & Compare Result
document.getElementById('submit-btn').onclick = () => {
    if(!started) return alert("You haven't started the test yet!");
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

    document.getElementById('res-wpm').innerText = wpm || 0;
    document.getElementById('res-acc').innerText = acc;
    document.getElementById('error-analysis').innerHTML = html;
    document.getElementById('result-modal').style.display = 'flex';

    // Data Backup
    const resultData = {
        date: new Date().toLocaleDateString(),
        testName: currentTestName,
        wpm: wpm || 0,
        accuracy: acc
    };
    studentResults.push(resultData);
    localStorage.setItem('localResults', JSON.stringify(studentResults));
    saveToStudentDrive(resultData); // Upload JSON to user's Drive
};

// Save JSON to Drive
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

// Format Buttons (Bold, Italic, etc)
document.querySelectorAll('.t-btn').forEach(btn => {
    btn.onclick = () => { 
        if(!started) return;
        document.execCommand(btn.dataset.cmd, false, null); 
        document.getElementById('editor').focus(); 
    };
});

// UI Navigation functions
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
