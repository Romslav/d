class LoyaltyApp {
    constructor() {
        this.currentUser = null;
        this.userData = null;
        this.currentScreen = 'dashboard';
        this.init();
    }

    init() {
        // Инициализация Telegram WebApp
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();
            
            // Тема
            if (tg.colorScheme === 'dark') {
                document.body.setAttribute('data-theme', 'dark');
            }
            
            this.currentUser = tg.initDataUnsafe?.user || {
                id: Math.floor(Math.random() * 1000000),
                first_name: 'Гость',
                username: 'guest'
            };
        } else {
            this.currentUser = { id: 12345, first_name: 'Иван', username: 'testuser' };
        }

        this.loadUserData();
        this.bindEvents();
        this.hidePreloader();
        this.render();
        
        // Главная кнопка Telegram
        if (window.Telegram?.WebApp) {
            const tg = window.Telegram.WebApp;
            tg.MainButton.setText('💾 Сохранить данные').onClick(() => this.sendToBot()).show();
            tg.MainButton.setParams({ color: '#4CAF50', text_color: '#fff' });
        }
    }

    loadUserData() {
        const key = `loyalty_${this.currentUser.id}`;
        this.userData = JSON.parse(localStorage.getItem(key)) || this.getDefaultData();
        this.syncLevels();
    }

    getDefaultData() {
        return {
            balance: 1240,
            level: 1,
            nextLevelPoints: 760,
            totalSpent: 2345,
            phone: '',
            birthday: '',
            notifications: true,
            history: [
                { id: 1, type: 'add', amount: 320, date: '2026-01-07', note: 'Чек #0456 (4,000₽)', status: 'confirmed' },
                { id: 2, type: 'spend', amount: 500, date: '2026-01-05', note: 'Скидка 500₽', status: 'used' },
                { id: 3, type: 'add', amount: 200, date: '2026-01-03', note: 'Реферал Иван', status: 'confirmed' },
                { id: 4, type: 'promo', amount: 500, date: '2025-12-31', note: 'Новый год!', status: 'confirmed' },
                { id: 5, type: 'add', amount: 220, date: '2025-12-28', note: 'Чек #0321 (2,750₽)', status: 'confirmed' }
            ],
            referrals: {
                invited: 5,
                active: 3,
                earned: 600
            },
            referralCode: 'R-LOY-' + Math.random().toString(36).substr(2, 5).toUpperCase()
        };
    }

    syncLevels() {
        const levels = [
            { name: 'Бронза', threshold: 0, rate: 0.05, badge: '🥉' },
            { name: 'Серебро', threshold: 5000, rate: 0.07, badge: '🥈' },
            { name: 'Золото', threshold: 15000, rate: 0.10, badge: '🥇' },
            { name: 'VIP', threshold: 40000, rate: 0.12, badge: '👑' }
        ];

        let currentLevel = 0;
        for (let i = 0; i < levels.length; i++) {
            if (this.userData.totalSpent >= levels[i].threshold) {
                currentLevel = i;
            } else {
                break;
            }
        }

        this.userData.currentLevel = levels[currentLevel];
        this.userData.nextLevel = levels[Math.min(currentLevel + 1, levels.length - 1)];
        this.userData.bonusRate = levels[currentLevel].rate;
    }

    bindEvents() {
        // Навигация
        document.querySelectorAll('.bottom-nav .nav-item, [data-screen]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const screen = e.currentTarget.dataset.screen || e.currentTarget.closest('[data-screen]').dataset.screen;
                this.showScreen(screen);
            });
        });

        // Checkin methods
        document.querySelectorAll('.method-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const method = btn.dataset.method;
                document.getElementById('qrScanner').classList.toggle('hidden', method !== 'qr');
                document.getElementById('manualInput').classList.toggle('hidden', method !== 'manual');
            });
        });

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                btn.parentElement.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.parentElement.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(tab + 'Tab').classList.add('active');
            });
        });

        // Filters
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.renderHistory();
            });
        });

        // Discount slider
        const slider = document.getElementById('discountSlider');
        slider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('discountAmount').textContent = value;
            document.getElementById('discountRub').textContent = value + '₽';
            this.generateDiscountQR(value);
        });
    }

    showScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        document.getElementById(screenName).classList.add('active');
        this.currentScreen = screenName;
        
        // Update navbar title
        const titles = {
            dashboard: 'Лояльность',
            checkin: 'Начислить бонусы',
            spend: 'Потратить баллы',
            'qr-card': 'Моя карта',
            promos: 'Акции',
            referrals: 'Пригласи друга',
            history: 'История',
            profile: 'Профиль'
        };
        document.getElementById('pageTitle').textContent = titles[screenName] || 'Лояльность';
        
        // Update bottom nav
        document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.screen === screenName);
        });

        // Screen-specific rendering
        if (screenName === 'dashboard') this.renderDashboard();
        if (screenName === 'qr-card') this.renderQRCard();
        if (screenName === 'history') this.renderHistory();
        if (screenName === 'referrals') this.renderReferrals();
    }

    render() {
        this.renderDashboard();
        this.renderHistory();
        this.renderReferrals();
        this.renderProfile();
        this.generateDiscountQR(100);
    }

    renderDashboard() {
        document.getElementById('userName').textContent = this.currentUser.first_name;
        document.getElementById('avatar').textContent = this.currentUser.first_name[0].toUpperCase();
        
        document.getElementById('balanceValue').textContent = this.userData.balance.toLocaleString();
        document.getElementById('rublesValue').textContent = this.userData.balance.toLocaleString() + '₽';
        document.getElementById('statusBadge').textContent = this.userData.currentLevel.badge + ' ' + this.userData.currentLevel.name;
        document.getElementById('statusBadge').className = `status-badge status-${this.userData.currentLevel.name.toLowerCase()}`;
        
        document.getElementById('nextLevelName').textContent = this.userData.nextLevel.name;
        document.getElementById('nextLevelPoints').textContent = this.userData.nextLevelPoints.toLocaleString();
        
        document.getElementById('progressFill').style.width = 
            Math.max(0, Math.min(100, (100 - (this.userData.nextLevelPoints / 5)))) + '%';
    }

    renderQRCard() {
        document.getElementById('statusLarge').textContent = 
            this.userData.currentLevel.badge + ' ' + this.userData.currentLevel.name;
        document.getElementById('loyaltyQR').textContent = 
            `ID: ${this.userData.referralCode}
${this.userData.currentLevel.name}
${this.userData.balance} баллов`;
        document.getElementById('cardId').innerHTML = `<strong>${this.userData.referralCode}</strong>`;
    }

    renderHistory(filter = 'all') {
        const list = document.getElementById('historyList');
        const filteredHistory = this.userData.history.filter(item => 
            filter === 'all' || item.type === filter
        );
        
        list.innerHTML = filteredHistory.map(item => `
            <div class="history-item">
                <div class="history-icon ${item.type}">
                    ${item.type === 'add' ? '➕' : item.type === 'spend' ? '➖' : '🎁'}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: 600;">${item.note}</div>
                    <div style="color: #666; font-size: 14px; margin-top: 4px;">
                        ${new Date(item.date).toLocaleDateString('ru-RU')}
                    </div>
                </div>
                <div style="font-size: 18px; font-weight: 700; min-width: 80px;">
                    ${item.type === 'spend' ? '-' : '+'}${item.amount}
                </div>
            </div>
        `).join('');
    }

    renderReferrals() {
        document.querySelector('.stat-number:nth-child(1)').textContent = this.userData.referrals.invited;
        document.querySelector('.stat-number:nth-child(3)').textContent = this.userData.referrals.active;
        document.querySelector('.stat-number:nth-child(5)').textContent = this.userData.referrals.earned;
        document.querySelector('.link-text').textContent = `t.me/RestBot?start=ref_${this.userData.referralCode}`;
    }

    renderProfile() {
        document.getElementById('phoneInput').value = this.userData.phone;
        document.getElementById('birthdayInput').value = this.userData.birthday;
        document.getElementById('notifications').checked = this.userData.notifications;
    }

    async processManualCheck() {
        const amount = parseFloat(document.getElementById('checkAmount').value);
        if (!amount || amount < 100) {
            this.showAlert('Введите сумму чека от 100₽');
            return;
        }

        const bonus = Math.floor(amount * this.userData.bonusRate);
        this.userData.balance += bonus;
        this.userData.nextLevelPoints = Math.max(0, this.userData.nextLevelPoints - bonus);
        this.userData.totalSpent += amount;
        this.userData.history.unshift({
            id: Date.now(),
            type: 'add',
            amount: bonus,
            date: new Date().toISOString().slice(0,10),
            note: `Чек ${amount.toLocaleString()}₽ (${Math.round(this.userData.bonusRate*100)}%)`,
            status: 'pending'
        });

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            this.showAlert(`+${bonus} баллов начислено!`);
        }

        this.syncLevels();
        this.saveData();
        this.render();
        document.getElementById('checkAmount').value = '';
    }

    generateDiscountQR(amount) {
        document.getElementById('discountQR').textContent = 
            `СПИСАТЬ
${amount} баллов

${this.userData.referralCode}
DISC-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    }

    redeemReward(type) {
        const rewards = {
            coffee: { name: 'Кофе', cost: 200 },
            dessert: { name: 'Десерт', cost: 400 }
        };

        const reward = rewards[type];
        if (this.userData.balance < reward.cost) {
            this.showAlert('Недостаточно баллов');
            return;
        }

        this.userData.balance -= reward.cost;
        this.userData.history.unshift({
            id: Date.now(),
            type: 'spend',
            amount: reward.cost,
            date: new Date().toISOString().slice(0,10),
            note: `${reward.name} (${reward.cost} баллов)`,
            status: 'used'
        });

        this.saveData();
        this.render();
        this.showAlert(`🎉 ${reward.name} получен!`);
    }

    shareReferral() {
        const url = `https://t.me/share/url?url=t.me/RestBot?start=ref_${this.userData.referralCode}&text=Приглашаю в программу лояльности ресторана! +200 баллов нам обоим за первый заказ! 🎁`;
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.openTelegramLink(url);
        } else {
            window.open(url, '_blank');
        }
    }

    saveProfile() {
        this.userData.phone = document.getElementById('phoneInput').value;
        this.userData.birthday = document.getElementById('birthdayInput').value;
        this.userData.notifications = document.getElementById('notifications').checked;
        this.saveData();
        this.showAlert('Профиль сохранен!');
    }

    saveData() {
        localStorage.setItem(`loyalty_${this.currentUser.id}`, JSON.stringify(this.userData));
    }

    sendToBot() {
        const data = {
            userId: this.currentUser.id,
            userName: this.currentUser.first_name,
            balance: this.userData.balance,
            level: this.userData.currentLevel.name,
            totalSpent: this.userData.totalSpent,
            phone: this.userData.phone,
            action: 'update_profile'
        };

        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.sendData(JSON.stringify(data));
            window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
            this.showAlert('Данные отправлены боту!');
        }
    }

    showAlert(message) {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.showAlert(message);
        } else {
            alert(message);
        }
    }

    hidePreloader() {
        setTimeout(() => {
            document.getElementById('preloader').style.opacity = '0';
            setTimeout(() => {
                document.getElementById('preloader').style.display = 'none';
            }, 300);
        }, 1500);
    }
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', () => {
    window.loyaltyApp = new LoyaltyApp();
});
