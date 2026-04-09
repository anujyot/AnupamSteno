pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// ✅ AAPKI KEYS
const CLIENT_ID = '1099442490417-04i1f2t2ilj31ddki1c4fhcm3bgdr2j6.apps.googleusercontent.com';
const API_KEY = 'AIzaSyC657KGTX-fn3TxdYptSIedkQ0ZKd4lfUI';
const ADMIN_FOLDER_ID = '10pTgGbmUDlOvbUuJDYuIrBy3svSif2-s';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
let tokenClient, accessToken = null, currentOriginalText = "", currentTestName = "", timerInterval, timeLeft = 900, started = false;

// 1. Google Login
window.onload = function () {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES,
        callback: (res) => { 
            accessToken = res.access_token; 
            document.getElementById('home-page').style.display = 'none'; 
            document.getElementById('dashboard-page').style.display = 'flex'; 
        }
    });
};

function handleGoogleLogin() { tokenClient.requestAccessToken(); }

// 2. Font Size Control
function changeFontSize(type) {
    const ed = document.getElementById('editor');
    let size = parseInt(window.getComputedStyle(ed).fontSize);
    ed.style.fontSize = (type === 'inc' ? size + 2 : size - 2) + 'px';
}

// 3. Test List Fetch
async function toggleTestList() {
    const list = document.getElementById('inline-test-list');
    list.style.display = list.style.display === 'flex' ? 'none' : 'flex';
    list.innerHTML = 'Loading tests...';
    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files?q='${ADMIN_FOLDER_ID}'+in+parents&key=${API_KEY}`);
        const data = await res.json();
        list.innerHTML = data.files.map(f => `<div class="test-box" onclick="startTest('${f.id}', '${f.name}')">${f.name.replace('.pdf','')}</div>`).join('');
    } catch(e) { list.innerHTML = "Error loading files."; }
}

// 4. Load PDF & Setup Button (Fixed Connection)
async function startTest(id, name) {
    currentTestName = name.replace('.pdf','');
    document.getElementById('dashboard-page').style.display = 'none';
    document.getElementById('workspace-page').style.display = 'flex';
    
    const container = document.getElementById('pdf-container');
    container.innerHTML = '<div style="color:white;text-align:center;margin-top:20px;">Downloading HD PDF...</div>';
    
    try {
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&key=${API_KEY}`);
        const pdf = await pdfjsLib.getDocument({data: await res.arrayBuffer()}).promise;
        container.innerHTML = ''; currentOriginalText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({scale: 4.0}); // HD
            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            canvas.height = viewport.height; canvas.width = viewport.width;
            await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
            const wrap = document.createElement('div'); wrap.className = 'pdf-wrap';
            wrap.appendChild(canvas); container.appendChild(wrap);
            
            const textContent = await page.getTextContent();
            let lastY, pageText = "";
            textContent.items.forEach(item => {
                if (lastY !== undefined && Math.abs(lastY - item.transform[5]) > 5) pageText += "\n";
                pageText += item.str + " ";
                lastY = item.transform[5];
            });
            currentOriginalText += pageText + "\n";
        }

        // ✅ BUTTON FIX: Isko yahan connect kar rahe hain
        clearInterval(timerInterval);
        timeLeft = 900;
        document.getElementById('timer').innerText = "15:00";
        started = false;

        const startBtn = document.getElementById('start-test-btn');
        startBtn.innerText = "Start Test";
        startBtn.style.background = "#10b981";
        // Button ko click event dena
        startBtn.onclick = function() { beginTypingTest(); };
        
        const ed = document.getElementById('editor');
        ed.contentEditable = false;
        ed.innerHTML = `<div style='color:#94a3b8; text-align:center; margin-top:100px;'>Test Loaded: ${currentTestName}<br>Click 'Start Test' button to begin.</div>`;

    } catch(e) { 
        console.error(e);
        container.innerHTML = "<div style='color:red;'>Error loading PDF. Make sure it is public.</div>"; 
    }
}

// 5. Start Typing Logic
function beginTypingTest() {
    started = true;
    const ed = document.getElementById('editor');
    ed.contentEditable = true; 
    ed.innerHTML = ""; 
    ed.focus();

    const btn = document.getElementById('start-test-btn');
    btn.innerText = currentTestName;
    btn.style.background = "#334155";
    btn.onclick = null; // Click disable after start
    
    timerInterval = setInterval(() => {
        timeLeft--;
        let m = Math.floor(timeLeft/60), s = timeLeft%60;
        document.getElementById('timer').innerText = `${m}:${s<10?'0':''}${s}`;
        if(timeLeft <= 0) {
            clearInterval(timerInterval);
            document.getElementById('submit-btn').click();
        }
    }, 1000);
}

// 6. Result Comparison
document.getElementById('submit-btn').onclick = () => {
    if(!started) return alert("Test start nahi hua!");
    clearInterval(timerInterval);
    
    const editor = document.getElementById('editor');
    const typedText = editor.innerText;
    const typedWords = typedText.trim().split(/\s+/);
    const refLines = currentOriginalText.split("\n");
    
    let mistakes = 0, finalHtml = "";
    let wordPointer = 0;

    refLines.forEach((refLine) => {
        if (!refLine.trim()) return;
        let refWords = refLine.trim().split(/\s+/);
        
        refWords.forEach(ref => {
            let typed = typedWords[wordPointer] || "";
            if (typed === ref || typed.toLowerCase() === ref.toLowerCase() || (ref.endsWith(':') && typed === ref.replace(':',''))) {
                finalHtml += `<span class="text-correct">${ref}</span> `;
            } else if (typed === "") {
                mistakes++; finalHtml += `<span class="text-missing">${ref}</span> `;
            } else {
                mistakes++; finalHtml += `<span class="text-error">${typed}</span><span class="text-correct">(${ref})</span> `;
            }
            wordPointer++;
        });
        finalHtml += "\n";
    });

    if(!editor.innerHTML.includes('<hr>')) finalHtml = '<div class="hr-mistake"></div>' + finalHtml;

    document.getElementById('res-wpm').innerText = Math.round((typedWords.length/5)/((900-timeLeft)/60)) || 0;
    const totalRefWords = currentOriginalText.trim().split(/\s+/).length;
    document.getElementById('res-acc').innerText = ((totalRefWords-mistakes)/totalRefWords*100).toFixed(1) + "%";
    document.getElementById('error-analysis').innerHTML = finalHtml;
    document.getElementById('result-modal').style.display = 'flex';
};

function backToDashboard() { location.reload(); }

// Toolbar Buttons
document.querySelectorAll('.t-btn').forEach(b => {
    if(b.dataset.cmd) b.onclick = () => { 
        if(!started) return;
        document.execCommand(b.dataset.cmd); 
        document.getElementById('editor').focus(); 
    };
});
