// 全局状态
let token = localStorage.getItem('token');
let currentUser = localStorage.getItem('username');
const API_BASE = 'http://localhost:4000';

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        showMainPage();
        loadStats();
    } else {
        showAuthPage();
    }
});

// 显示提示消息
function showAlert(elementId, message, type = 'info') {
    const alertDiv = document.getElementById(elementId);
    alertDiv.innerHTML = `<div class="alert alert-${type}">${message}</div>`;
    setTimeout(() => {
        alertDiv.innerHTML = '';
    }, 5000);
}

// 页面切换
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

function showAuthPage() {
    showPage('authPage');
}

function showMainPage() {
    if (!token) {
        showAuthPage();
        return;
    }
    document.getElementById('currentUser').textContent = currentUser;
    showPage('mainPage');
    loadStats();
}

function showLearnPage() {
    showPage('learnPage');
}

function showReviewPage() {
    showPage('reviewPage');
    loadReviews();
}

function showQuizPage() {
    showPage('quizPage');
    loadQuiz();
}

// 认证功能
async function register() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showAlert('authAlert', '请输入用户名和密码', 'error');
        return;
    }

    if (password.length < 6) {
        showAlert('authAlert', '密码至少需要6位', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            token = data.token;
            currentUser = username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            showAlert('authAlert', '注册成功！正在跳转...', 'success');
            setTimeout(() => showMainPage(), 1000);
        } else {
            showAlert('authAlert', data.error || '注册失败', 'error');
        }
    } catch (error) {
        showAlert('authAlert', '网络错误，请重试', 'error');
    }
}

async function login() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (!username || !password) {
        showAlert('authAlert', '请输入用户名和密码', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (data.success) {
            token = data.token;
            currentUser = username;
            localStorage.setItem('token', token);
            localStorage.setItem('username', username);
            showAlert('authAlert', '登录成功！正在跳转...', 'success');
            setTimeout(() => showMainPage(), 1000);
        } else {
            showAlert('authAlert', data.error || '登录失败', 'error');
        }
    } catch (error) {
        showAlert('authAlert', '网络错误，请重试', 'error');
    }
}

function logout() {
    token = null;
    currentUser = null;
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    showAuthPage();
}

// 加载统计数据
async function loadStats() {
    try {
        // 获取待复习数量
        const reviewResponse = await fetch(`${API_BASE}/api/reviews/due?limit=100`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const reviewData = await reviewResponse.json();
        
        if (reviewData.success) {
            document.getElementById('dueReviews').textContent = reviewData.totalDue || 0;
        }

        // 这里可以添加更多统计数据的加载
        // 由于当前 API 没有提供总单词数和完成数的端点，我们使用模拟数据
        document.getElementById('totalWords').textContent = '0';
        document.getElementById('completedReviews').textContent = '0';
    } catch (error) {
        console.error('加载统计数据失败:', error);
    }
}

// 翻译单词
async function translateWord() {
    const word = document.getElementById('wordInput').value.trim();
    
    if (!word) {
        showAlert('learnAlert', '请输入单词', 'error');
        return;
    }

    if (!/^[a-zA-Z\s]+$/.test(word)) {
        showAlert('learnAlert', '只能输入英文字母和空格', 'error');
        return;
    }

    const resultDiv = document.getElementById('translationResult');
    resultDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>正在翻译和获取图片...</p></div>';

    try {
        const response = await fetch(`${API_BASE}/api/words/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ word })
        });

        const data = await response.json();

        if (data.success) {
            resultDiv.innerHTML = `
                <div class="word-card">
                    <h3>📖 ${data.word}</h3>
                    <p><strong>中文翻译：</strong>${data.translation}</p>
                    ${data.imageUrl ? `<img src="${data.imageUrl}" alt="${data.word}" style="width: 100%; max-width: 400px; border-radius: 8px; margin-top: 10px;">` : ''}
                    <button class="btn btn-primary" onclick="saveWord('${data.word}', '${data.translation}', '${data.imageUrl || ''}')">💾 保存到学习列表</button>
                </div>
            `;
        } else {
            showAlert('learnAlert', data.error || '翻译失败', 'error');
            resultDiv.innerHTML = '';
        }
    } catch (error) {
        showAlert('learnAlert', '网络错误，请重试', 'error');
        resultDiv.innerHTML = '';
    }
}

// 保存单词
async function saveWord(word, translation, imageUrl) {
    try {
        const response = await fetch(`${API_BASE}/api/words/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ word, translation, imageUrl })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('learnAlert', '✅ 单词保存成功！已创建复习计划', 'success');
            document.getElementById('wordInput').value = '';
            document.getElementById('translationResult').innerHTML = '';
            loadStats();
        } else {
            showAlert('learnAlert', data.error || '保存失败', 'error');
        }
    } catch (error) {
        showAlert('learnAlert', '网络错误，请重试', 'error');
    }
}

// 加载复习列表
async function loadReviews() {
    const contentDiv = document.getElementById('reviewContent');
    contentDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>正在加载复习列表...</p></div>';

    try {
        const response = await fetch(`${API_BASE}/api/reviews/due?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            if (data.reviews.length === 0) {
                contentDiv.innerHTML = `
                    <div class="alert alert-info">
                        🎉 太棒了！当前没有需要复习的单词。
                    </div>
                `;
            } else {
                let html = `<h3 style="margin-bottom: 20px;">📋 待复习单词列表 (${data.totalDue}个)</h3>`;
                
                data.reviews.forEach(review => {
                    html += `
                        <div class="word-card">
                            <h3>${review.englishWord}</h3>
                            <p><strong>中文：</strong>${review.chineseTranslation}</p>
                            <p><strong>到期时间：</strong>${new Date(review.dueDate).toLocaleString('zh-CN')}</p>
                            ${review.imageUrl ? `<img src="${review.imageUrl}" alt="${review.englishWord}" style="width: 100%; max-width: 300px; border-radius: 8px; margin-top: 10px;">` : ''}
                        </div>
                    `;
                });

                contentDiv.innerHTML = html;
            }
        } else {
            showAlert('reviewAlert', data.error || '加载失败', 'error');
            contentDiv.innerHTML = '';
        }
    } catch (error) {
        showAlert('reviewAlert', '网络错误，请重试', 'error');
        contentDiv.innerHTML = '';
    }
}

// 加载测验
async function loadQuiz() {
    const contentDiv = document.getElementById('quizContent');
    contentDiv.innerHTML = '<div class="loading"><div class="spinner"></div><p>正在生成测验...</p></div>';

    try {
        const response = await fetch(`${API_BASE}/api/quiz/generate?limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success) {
            if (data.questions.length === 0) {
                contentDiv.innerHTML = `
                    <div class="alert alert-info">
                        ${data.message || '当前没有可用的测验题目。请先学习一些单词！'}
                    </div>
                `;
            } else {
                displayQuiz(data.questions);
            }
        } else {
            showAlert('quizAlert', data.error || '加载失败', 'error');
            contentDiv.innerHTML = '';
        }
    } catch (error) {
        showAlert('quizAlert', '网络错误，请重试', 'error');
        contentDiv.innerHTML = '';
    }
}

// 显示测验题目
let currentQuestions = [];
let currentQuestionIndex = 0;
let quizScore = 0;

function displayQuiz(questions) {
    currentQuestions = questions;
    currentQuestionIndex = 0;
    quizScore = 0;
    displayCurrentQuestion();
}

function displayCurrentQuestion() {
    if (currentQuestionIndex >= currentQuestions.length) {
        displayQuizResults();
        return;
    }

    const question = currentQuestions[currentQuestionIndex];
    const contentDiv = document.getElementById('quizContent');

    let html = `
        <div style="margin-bottom: 20px;">
            <h3>题目 ${currentQuestionIndex + 1} / ${currentQuestions.length}</h3>
            <div class="word-card">
                <h2 style="text-align: center; color: #667eea; font-size: 2em;">${question.word}</h2>
                <p style="text-align: center; color: #666; font-size: 1.2em;">${question.translation}</p>
            </div>
        </div>

        <p style="text-align: center; margin-bottom: 15px; font-weight: bold;">请选择正确的图片：</p>

        <div class="quiz-options" id="quizOptions">
    `;

    question.options.forEach((option, index) => {
        html += `
            <div class="quiz-option" onclick="selectQuizOption(${index}, '${option.imageUrl}', ${option.isCorrect})">
                <img src="${option.imageUrl}" alt="选项 ${index + 1}" onerror="this.src='https://via.placeholder.com/150?text=Image+Not+Found'">
                <p>选项 ${index + 1}</p>
            </div>
        `;
    });

    html += '</div>';

    contentDiv.innerHTML = html;
}

function selectQuizOption(index, imageUrl, isCorrect) {
    const options = document.querySelectorAll('.quiz-option');
    options.forEach(opt => opt.style.pointerEvents = 'none');

    const selectedOption = options[index];
    
    if (isCorrect) {
        selectedOption.classList.add('correct');
        quizScore++;
        showAlert('quizAlert', '✅ 回答正确！', 'success');
    } else {
        selectedOption.classList.add('incorrect');
        // 显示正确答案
        options.forEach((opt, i) => {
            if (currentQuestions[currentQuestionIndex].options[i].isCorrect) {
                opt.classList.add('correct');
            }
        });
        showAlert('quizAlert', '❌ 回答错误，正确答案已标记为绿色', 'error');
    }

    // 记录答题结果
    submitQuizAnswer(currentQuestions[currentQuestionIndex].questionId, imageUrl);

    // 2秒后显示下一题
    setTimeout(() => {
        currentQuestionIndex++;
        displayCurrentQuestion();
    }, 2000);
}

async function submitQuizAnswer(questionId, selectedImageUrl) {
    try {
        await fetch(`${API_BASE}/api/quiz/answer`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ questionId, selectedImageUrl })
        });
    } catch (error) {
        console.error('提交答案失败:', error);
    }
}

function displayQuizResults() {
    const contentDiv = document.getElementById('quizContent');
    const percentage = Math.round((quizScore / currentQuestions.length) * 100);
    
    let message = '';
    let emoji = '';
    
    if (percentage >= 80) {
        message = '太棒了！继续保持！';
        emoji = '🎉';
    } else if (percentage >= 60) {
        message = '不错！继续努力！';
        emoji = '👍';
    } else {
        message = '加油！多复习会更好！';
        emoji = '💪';
    }

    contentDiv.innerHTML = `
        <div style="text-align: center; padding: 40px;">
            <h2 style="font-size: 3em; margin-bottom: 20px;">${emoji}</h2>
            <h3 style="color: #667eea; margin-bottom: 10px;">测验完成！</h3>
            <div class="stat-card" style="max-width: 300px; margin: 20px auto;">
                <h4>${quizScore} / ${currentQuestions.length}</h4>
                <p>正确率：${percentage}%</p>
            </div>
            <p style="font-size: 1.2em; color: #666; margin-top: 20px;">${message}</p>
            <button class="btn btn-primary" onclick="loadQuiz()" style="margin-top: 30px; max-width: 300px;">再来一次</button>
        </div>
    `;

    loadStats();
}
