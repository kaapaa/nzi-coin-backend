class GameState {
    constructor() {
        this.config = {
            initialEnergy: 100,
            energyRegenRate: 1800000, // 30 minutes per energy
            baseCoinsPerTap: 1,
            maxEnergyLevels: [100, 150, 200, 300, 500],
            regenRateLevels: [1800000, 1500000, 1200000, 900000, 600000], // 30min, 25min, 20min, 15min, 10min
            coinsPerTapLevels: [1, 2, 3, 5, 10],
            boosterCosts: {
                energyCapacity: [100, 250, 500, 1000],
                energyRegen: [150, 300, 600, 1200],
                coinsPerTap: [200, 400, 800, 1600]
            },
            tasks: {
                dailyLogin: { reward: 100, completed: false },
                tapChampion: { target: 1000, reward: 500, progress: 0, completed: false },
                recruit: { target: 1, reward: 1000, progress: 0, completed: false },
                energyMaster: { target: 500, reward: 2000, progress: 100, completed: false }
            }
        };

        this.defaultState = {
            coins: 0,
            energy: this.config.initialEnergy,
            maxEnergy: this.config.maxEnergyLevels[0],
            coinsPerTap: this.config.coinsPerTapLevels[0],
            energyRegenRate: this.config.regenRateLevels[0],
            totalEarned: 0,
            totalTaps: 0,
            lastSave: Date.now(),
            lastDailyLogin: 0,
            streakCount: 1,
            boosters: {
                energyCapacity: 0,
                energyRegen: 0,
                coinsPerTap: 0
            },
            tasks: { ...this.config.tasks },
            friends: 0,
            firstTime: true,
            stakingNotified: false
        };

        this.state = { ...this.defaultState };
        this.energyRegenInterval = null;
        this.saveInterval = null;
        
        this.loadGame();
        this.calculateOfflineProgress();
        this.checkDailyLogin();
        this.startEnergyRegen();
        this.startAutoSave();
    }

    saveGame() {
        try {
            this.state.lastSave = Date.now();
            localStorage.setItem('nziBlitzkriegGame', JSON.stringify(this.state));
        } catch (e) {
            console.warn('Could not save game:', e);
        }
    }

    loadGame() {
        try {
            const saved = localStorage.getItem('nziBlitzkriegGame');
            if (saved) {
                const parsedState = JSON.parse(saved);
                this.state = { ...this.defaultState, ...parsedState };
                this.state.firstTime = false;
                
                // Ensure tasks structure is up to date
                this.state.tasks = { ...this.config.tasks, ...this.state.tasks };
                
                // Ensure new properties exist
                if (this.state.stakingNotified === undefined) {
                    this.state.stakingNotified = false;
                }
            }
        } catch (e) {
            console.warn('Could not load game:', e);
            this.state = { ...this.defaultState };
        }
    }

    calculateOfflineProgress() {
        if (this.state.lastSave && this.state.energy < this.state.maxEnergy) {
            const timeOffline = Date.now() - this.state.lastSave;
            const energyToRegenerate = Math.floor(timeOffline / this.state.energyRegenRate);
            
            if (energyToRegenerate > 0) {
                this.state.energy = Math.min(this.state.maxEnergy, this.state.energy + energyToRegenerate);
            }
        }
    }

    checkDailyLogin() {
        const today = new Date().toDateString();
        const lastLogin = new Date(this.state.lastDailyLogin).toDateString();
        
        if (today !== lastLogin) {
            this.state.lastDailyLogin = Date.now();
            if (!this.state.tasks.dailyLogin.completed) {
                this.completeTask('dailyLogin');
            }
            // Reset daily tasks
            this.state.tasks.dailyLogin.completed = false;
        }
    }

    completeTask(taskId) {
        const task = this.state.tasks[taskId];
        if (task && !task.completed) {
            task.completed = true;
            this.state.coins += task.reward;
            this.state.totalEarned += task.reward;
            return true;
        }
        return false;
    }

    updateTaskProgress(taskId, progress) {
        const task = this.state.tasks[taskId];
        if (task && !task.completed) {
            task.progress = Math.min(progress, task.target);
            if (task.progress >= task.target) {
                return this.completeTask(taskId);
            }
        }
        return false;
    }

    startEnergyRegen() {
        if (this.energyRegenInterval) {
            clearInterval(this.energyRegenInterval);
        }
        
        this.energyRegenInterval = setInterval(() => {
            if (this.state.energy < this.state.maxEnergy) {
                this.state.energy++;
                this.updateEnergyDisplay();
            }
        }, this.state.energyRegenRate);
    }

    startAutoSave() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }

        this.saveInterval = setInterval(() => {
            this.saveGame();
        }, 5000); // Save every 5 seconds
    }

    updateEnergyDisplay() {
        const energyBar = document.getElementById('energyBar');
        const energyText = document.getElementById('energyText');
        
        if (energyBar && energyText) {
            const percentage = (this.state.energy / this.state.maxEnergy) * 100;
            energyBar.style.width = `${percentage}%`;
            energyText.textContent = `${this.state.energy}/${this.state.maxEnergy}`;
        }
    }

    updateCoinDisplays() {
        const coinCounters = [
            'coinCounter', 'investCoinCounter', 
            'friendsCoinCounter', 'tasksCoinCounter'
        ];
        
        coinCounters.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = this.formatNumber(this.state.coins);
            }
        });
    }

    updateAllDisplays() {
        this.updateCoinDisplays();
        this.updateEnergyDisplay();
        this.updateStatsDisplay();
        this.updateGameInfo();
        this.updateProfileDisplay();
    }

    updateStatsDisplay() {
        const totalEarned = document.getElementById('totalEarned');
        const totalTaps = document.getElementById('totalTaps');
        
        if (totalEarned) totalEarned.textContent = this.formatNumber(this.state.totalEarned);
        if (totalTaps) totalTaps.textContent = this.formatNumber(this.state.totalTaps);
    }

    updateGameInfo() {
        const coinsPerTapDisplay = document.getElementById('coinsPerTapDisplay');
        const energyRegenDisplay = document.getElementById('energyRegenDisplay');
        
        if (coinsPerTapDisplay) coinsPerTapDisplay.textContent = this.state.coinsPerTap;
        if (energyRegenDisplay) {
            const minutes = Math.floor(this.state.energyRegenRate / 60000);
            energyRegenDisplay.textContent = `${minutes}m`;
        }
    }

    updateProfileDisplay() {
        const profileCoins = document.getElementById('profileCoins');
        const profileFriends = document.getElementById('profileFriends');
        const leaderboardScore = document.getElementById('leaderboardScore');
        
        if (profileCoins) profileCoins.textContent = this.formatNumber(this.state.totalEarned);
        if (profileFriends) profileFriends.textContent = this.state.friends;
        if (leaderboardScore) leaderboardScore.textContent = this.formatNumber(this.state.totalEarned);
    }

    formatNumber(num) {
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(1) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    formatTimeToMinutes(milliseconds) {
        const minutes = Math.floor(milliseconds / 60000);
        return `${minutes}m`;
    }

    tap() {
        if (this.state.energy > 0) {
            this.state.energy--;
            this.state.coins += this.state.coinsPerTap;
            this.state.totalEarned += this.state.coinsPerTap;
            this.state.totalTaps++;
            
            // Update task progress
            this.updateTaskProgress('tapChampion', this.state.totalTaps);
            
            this.updateEnergyDisplay();
            this.updateCoinDisplays();
            this.updateStatsDisplay();
            
            return true;
        }
        return false;
    }

    canPurchaseBooster(boosterType) {
        const level = this.state.boosters[boosterType];
        const costs = this.config.boosterCosts[boosterType];
        
        if (level >= costs.length) return false;
        return this.state.coins >= costs[level];
    }

    purchaseBooster(boosterType) {
        if (!this.canPurchaseBooster(boosterType)) return false;

        const level = this.state.boosters[boosterType];
        const cost = this.config.boosterCosts[boosterType][level];
        
        this.state.coins -= cost;
        this.state.boosters[boosterType]++;

        this.applyBoosterEffects(boosterType);
        this.updateCoinDisplays();
        return true;
    }

    applyBoosterEffects(boosterType) {
        const level = this.state.boosters[boosterType];
        
        switch (boosterType) {
            case 'energyCapacity':
                const oldMax = this.state.maxEnergy;
                this.state.maxEnergy = this.config.maxEnergyLevels[level];
                if (this.state.energy === oldMax) {
                    this.state.energy = this.state.maxEnergy;
                }
                // Update energy master task
                this.updateTaskProgress('energyMaster', this.state.maxEnergy);
                break;
                
            case 'energyRegen':
                this.state.energyRegenRate = this.config.regenRateLevels[level];
                this.startEnergyRegen();
                break;
                
            case 'coinsPerTap':
                this.state.coinsPerTap = this.config.coinsPerTapLevels[level];
                break;
        }
        
        this.updateGameInfo();
        this.updateEnergyDisplay();
    }

    initializeBoosterEffects() {
        Object.keys(this.state.boosters).forEach(boosterType => {
            if (this.state.boosters[boosterType] > 0) {
                const level = this.state.boosters[boosterType];
                
                switch (boosterType) {
                    case 'energyCapacity':
                        this.state.maxEnergy = this.config.maxEnergyLevels[level];
                        break;
                    case 'energyRegen':
                        this.state.energyRegenRate = this.config.regenRateLevels[level];
                        break;
                    case 'coinsPerTap':
                        this.state.coinsPerTap = this.config.coinsPerTapLevels[level];
                        break;
                }
            }
        });
    }

    toggleStakingNotification() {
        this.state.stakingNotified = !this.state.stakingNotified;
        this.saveGame();
        return this.state.stakingNotified;
    }
}

class ModernGameUI {
    constructor() {
        this.gameState = new GameState();
        this.currentScreen = 'tap';
        this.isInitialized = false;
        
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            // Add a small delay to ensure everything is rendered
            setTimeout(() => this.initialize(), 100);
        }
    }

    initialize() {
        console.log('Initializing Modern Game UI...');
        
        try {
            this.initializeElements();
            this.setupEventListeners();
            this.setupBottomNavigation();
            this.updateAllDisplays();
            this.updateInvestmentDisplay();
            this.updateTasksDisplay();
            
            // Apply booster effects after load
            this.gameState.initializeBoosterEffects();
            this.updateAllDisplays();
            
            // Show tutorial for first-time players
            if (this.gameState.state.firstTime) {
                setTimeout(() => this.showTutorial(), 500);
            }
            
            this.isInitialized = true;
            console.log('Modern Game UI initialized successfully');
        } catch (error) {
            console.error('Error during initialization:', error);
        }
    }

    initializeElements() {
        this.elements = {
            // Screens
            screens: {
                tap: document.getElementById('tapScreen'),
                invest: document.getElementById('investScreen'),
                friends: document.getElementById('friendsScreen'),
                tasks: document.getElementById('tasksScreen')
            },
            
            // Main tap elements
            tapCoin: document.getElementById('tapCoin'),
            tapEffect: document.getElementById('tapEffect'),
            floatingCoins: document.getElementById('floatingCoins'),
            
            // Tutorial
            tutorialOverlay: document.getElementById('tutorialOverlay'),
            startGameBtn: document.getElementById('startGameBtn'),
            
            // Investment buttons
            energyCapBtn: document.getElementById('energyCapBtn'),
            energyRegenBtn: document.getElementById('energyRegenBtn'),
            coinsPerTapBtn: document.getElementById('coinsPerTapBtn'),
            
            // Staking
            stakingNotifyBtn: document.getElementById('stakingNotifyBtn'),
            
            // Navigation
            navItems: document.querySelectorAll('.nav-item'),
            
            // Other interactive elements
            shareBtn: document.getElementById('shareBtn')
        };

        console.log('Elements initialized. Screens found:', Object.keys(this.elements.screens).filter(key => this.elements.screens[key]).length);
        console.log('Navigation items found:', this.elements.navItems.length);
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Main tap functionality
        if (this.elements.tapCoin) {
            const handleTap = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleTap(e);
            };
            
            this.elements.tapCoin.addEventListener('click', handleTap);
            this.elements.tapCoin.addEventListener('touchend', handleTap);
        }

        // Tutorial
        if (this.elements.startGameBtn) {
            const hideTutorialHandler = (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.hideTutorial();
            };
            
            this.elements.startGameBtn.addEventListener('click', hideTutorialHandler);
            this.elements.startGameBtn.addEventListener('touchend', hideTutorialHandler);
        }

        // Tutorial overlay click to close
        if (this.elements.tutorialOverlay) {
            this.elements.tutorialOverlay.addEventListener('click', (e) => {
                if (e.target === this.elements.tutorialOverlay) {
                    this.hideTutorial();
                }
            });
        }

        // Investment buttons
        if (this.elements.energyCapBtn) {
            this.elements.energyCapBtn.addEventListener('click', () => {
                this.purchaseBooster('energyCapacity');
            });
        }

        if (this.elements.energyRegenBtn) {
            this.elements.energyRegenBtn.addEventListener('click', () => {
                this.purchaseBooster('energyRegen');
            });
        }

        if (this.elements.coinsPerTapBtn) {
            this.elements.coinsPerTapBtn.addEventListener('click', () => {
                this.purchaseBooster('coinsPerTap');
            });
        }

        // Staking notification button
        if (this.elements.stakingNotifyBtn) {
            this.elements.stakingNotifyBtn.addEventListener('click', () => {
                this.handleStakingNotification();
            });
        }

        // Share button
        if (this.elements.shareBtn) {
            this.elements.shareBtn.addEventListener('click', () => {
                this.shareReferralCode();
            });
        }

        console.log('Event listeners set up successfully');
    }

    setupBottomNavigation() {
        console.log('Setting up bottom navigation...');
        
        if (!this.elements.navItems || this.elements.navItems.length === 0) {
            console.error('No navigation items found!');
            return;
        }

        this.elements.navItems.forEach((navItem, index) => {
            const screen = navItem.getAttribute('data-screen');
            
            if (!screen) {
                console.warn(`Nav item ${index} has no data-screen attribute`);
                return;
            }
            
            const handleNavigation = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                console.log(`Navigation clicked: ${screen}`);
                
                // Switch screen
                this.switchScreen(screen);
                
                // Update navigation visual state
                this.updateNavigation(screen);
            };
            
            // Remove any existing listeners by cloning the node
            const newNavItem = navItem.cloneNode(true);
            navItem.parentNode.replaceChild(newNavItem, navItem);
            
            // Add event listeners to the new node
            newNavItem.addEventListener('click', handleNavigation);
            newNavItem.addEventListener('touchend', handleNavigation);
            
            console.log(`Set up navigation for: ${screen}`);
        });

        // Re-query navigation items after cloning
        this.elements.navItems = document.querySelectorAll('.nav-item');
        
        console.log('Bottom navigation setup complete');
    }

    switchScreen(screenName) {
        console.log(`Switching to screen: ${screenName}`);
        
        // Hide all screens
        Object.keys(this.elements.screens).forEach(key => {
            const screen = this.elements.screens[key];
            if (screen) {
                screen.classList.remove('active');
                console.log(`Hidden screen: ${key}`);
            }
        });
        
        // Show target screen
        const targetScreen = this.elements.screens[screenName];
        if (targetScreen) {
            targetScreen.classList.add('active');
            console.log(`Activated screen: ${screenName}`);
            
            // Update current screen state
            this.currentScreen = screenName;
            
            // Update screen-specific displays
            setTimeout(() => {
                if (screenName === 'invest') {
                    this.updateInvestmentDisplay();
                } else if (screenName === 'tasks') {
                    this.updateTasksDisplay();
                }
            }, 50);
            
        } else {
            console.error(`Screen not found: ${screenName}`);
            // Fallback to tap screen
            const tapScreen = this.elements.screens.tap;
            if (tapScreen) {
                tapScreen.classList.add('active');
                this.currentScreen = 'tap';
            }
        }
    }

    updateNavigation(activeScreen) {
        console.log(`Updating navigation for active screen: ${activeScreen}`);
        
        this.elements.navItems.forEach(navItem => {
            const screen = navItem.getAttribute('data-screen');
            navItem.classList.remove('active');
            
            if (screen === activeScreen) {
                navItem.classList.add('active');
                console.log(`Activated nav item: ${screen}`);
            }
        });
    }

    handleTap(e) {
        if (!this.isInitialized) return;
        
        if (this.gameState.tap()) {
            this.showTapEffect();
            this.showFloatingCoins(e);
            this.animateTapCoin();
            this.updateTasksDisplay();
        } else {
            this.showEnergyDepleted();
        }
    }

    showTapEffect() {
        const effect = this.elements.tapEffect;
        if (effect) {
            effect.classList.remove('animate');
            setTimeout(() => effect.classList.add('animate'), 10);
        }
    }

    showFloatingCoins(e) {
        if (!this.elements.tapCoin || !this.elements.floatingCoins) return;
        
        const rect = this.elements.tapCoin.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        for (let i = 0; i < this.gameState.state.coinsPerTap; i++) {
            setTimeout(() => {
                const coin = document.createElement('div');
                coin.className = 'floating-coin';
                coin.textContent = `+${this.gameState.state.coinsPerTap} NZI`;
                
                const offsetX = (Math.random() - 0.5) * 120;
                const offsetY = (Math.random() - 0.5) * 60;
                
                coin.style.left = (centerX + offsetX) + 'px';
                coin.style.top = (centerY + offsetY) + 'px';
                
                this.elements.floatingCoins.appendChild(coin);
                
                setTimeout(() => {
                    if (coin.parentNode) {
                        coin.parentNode.removeChild(coin);
                    }
                }, 2500);
            }, i * 100);
        }
    }

    animateTapCoin() {
        const coin = this.elements.tapCoin;
        if (coin) {
            coin.style.transform = 'scale(0.9)';
            setTimeout(() => {
                coin.style.transform = '';
            }, 100);
        }
    }

    showEnergyDepleted() {
        const coin = this.elements.tapCoin;
        if (coin) {
            coin.classList.add('disabled');
            
            const rect = coin.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            const message = document.createElement('div');
            message.className = 'floating-coin';
            message.textContent = 'Achtung! No Energy!';
            message.style.color = '#FF6B35';
            message.style.left = centerX + 'px';
            message.style.top = centerY + 'px';
            
            if (this.elements.floatingCoins) {
                this.elements.floatingCoins.appendChild(message);
                setTimeout(() => {
                    if (message.parentNode) {
                        message.parentNode.removeChild(message);
                    }
                }, 2500);
            }
            
            const checkEnergy = () => {
                if (this.gameState.state.energy > 0) {
                    coin.classList.remove('disabled');
                } else {
                    setTimeout(checkEnergy, 1000);
                }
            };
            setTimeout(checkEnergy, 1000);
        }
    }

    showTutorial() {
        console.log('Showing tutorial...');
        if (this.elements.tutorialOverlay) {
            this.elements.tutorialOverlay.style.display = 'flex';
        }
    }

    hideTutorial() {
        console.log('Hiding tutorial...');
        if (this.elements.tutorialOverlay) {
            this.elements.tutorialOverlay.style.display = 'none';
            this.gameState.state.firstTime = false;
            this.gameState.saveGame();
        }
    }

    purchaseBooster(boosterType) {
        if (this.gameState.purchaseBooster(boosterType)) {
            this.updateInvestmentDisplay();
            this.updateAllDisplays();
            this.showPurchaseSuccess(boosterType);
        }
    }

    showPurchaseSuccess(boosterType) {
        const messages = {
            energyCapacity: 'Energy Capacity Upgraded! ⚡',
            energyRegen: 'Energy Regen Boosted! 🔋',
            coinsPerTap: 'Coin Power Enhanced! 💰'
        };
        
        const message = document.createElement('div');
        message.className = 'floating-coin';
        message.textContent = messages[boosterType];
        message.style.color = '#00FF88';
        message.style.left = '50%';
        message.style.top = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.fontSize = '20px';
        
        if (this.elements.floatingCoins) {
            this.elements.floatingCoins.appendChild(message);
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 3000);
        }
    }

    handleStakingNotification() {
        const isNotified = this.gameState.toggleStakingNotification();
        const button = this.elements.stakingNotifyBtn;
        
        if (button) {
            if (isNotified) {
                button.innerHTML = '✅ You\'ll be notified!';
                button.style.background = 'var(--neon-green)';
                this.showStakingNotificationSuccess();
                setTimeout(() => {
                    button.innerHTML = '🔔 Notify Me When Available';
                    button.style.background = 'var(--color-disabled)';
                }, 3000);
            }
        }
    }

    showStakingNotificationSuccess() {
        const message = document.createElement('div');
        message.className = 'floating-coin';
        message.textContent = 'Staking notifications enabled! 🔔';
        message.style.color = '#00FF88';
        message.style.left = '50%';
        message.style.top = '50%';
        message.style.transform = 'translate(-50%, -50%)';
        message.style.fontSize = '18px';
        
        if (this.elements.floatingCoins) {
            this.elements.floatingCoins.appendChild(message);
            setTimeout(() => {
                if (message.parentNode) {
                    message.parentNode.removeChild(message);
                }
            }, 2500);
        }
    }

    updateInvestmentDisplay() {
        const boosters = [
            { type: 'energyCapacity', prefix: 'energyCap' },
            { type: 'energyRegen', prefix: 'energyRegen' },
            { type: 'coinsPerTap', prefix: 'coinsPerTap' }
        ];

        boosters.forEach(({ type, prefix }) => {
            const level = this.gameState.state.boosters[type];
            const costs = this.gameState.config.boosterCosts[type];
            
            const levelElement = document.getElementById(`${prefix}Level`);
            if (levelElement) levelElement.textContent = level + 1;
            
            const currentElement = document.getElementById(`${prefix}Current`);
            if (currentElement) {
                switch (type) {
                    case 'energyCapacity':
                        currentElement.textContent = this.gameState.config.maxEnergyLevels[level];
                        break;
                    case 'energyRegen':
                        currentElement.textContent = this.gameState.formatTimeToMinutes(this.gameState.config.regenRateLevels[level]);
                        break;
                    case 'coinsPerTap':
                        currentElement.textContent = this.gameState.config.coinsPerTapLevels[level];
                        break;
                }
            }
            
            const nextElement = document.getElementById(`${prefix}Next`);
            const costElement = document.getElementById(`${prefix}Cost`);
            const buttonElement = document.getElementById(`${prefix}Btn`);
            
            if (level >= costs.length) {
                if (nextElement) nextElement.textContent = 'MAX';
                if (costElement) costElement.textContent = 'MAX';
                if (buttonElement) {
                    buttonElement.textContent = 'MAX LEVEL';
                    buttonElement.disabled = true;
                }
            } else {
                if (nextElement) {
                    switch (type) {
                        case 'energyCapacity':
                            nextElement.textContent = this.gameState.config.maxEnergyLevels[level + 1] || 'MAX';
                            break;
                        case 'energyRegen':
                            nextElement.textContent = this.gameState.formatTimeToMinutes(this.gameState.config.regenRateLevels[level + 1] || 0);
                            break;
                        case 'coinsPerTap':
                            nextElement.textContent = this.gameState.config.coinsPerTapLevels[level + 1] || 'MAX';
                            break;
                    }
                }
                
                if (costElement) costElement.textContent = costs[level];
                
                if (buttonElement) {
                    const canAfford = this.gameState.canPurchaseBooster(type);
                    buttonElement.disabled = !canAfford;
                    buttonElement.innerHTML = `Upgrade - <span>${costs[level]}</span> NZI`;
                }
            }
        });

        const investCoinCounter = document.getElementById('investCoinCounter');
        if (investCoinCounter) {
            investCoinCounter.textContent = this.gameState.formatNumber(this.gameState.state.coins);
        }
    }

    updateTasksDisplay() {
        const tapTaskProgress = document.getElementById('tapTaskProgress');
        const tapTaskCount = document.getElementById('tapTaskCount');
        const tapTask = this.gameState.state.tasks.tapChampion;
        
        if (tapTaskProgress && tapTaskCount) {
            const progress = Math.min((tapTask.progress / tapTask.target) * 100, 100);
            tapTaskProgress.style.width = `${progress}%`;
            tapTaskCount.textContent = tapTask.progress;
        }

        const energyTaskProgress = document.getElementById('energyTaskProgress');
        const energyTaskCount = document.getElementById('energyTaskCount');
        const energyTask = this.gameState.state.tasks.energyMaster;
        
        if (energyTaskProgress && energyTaskCount) {
            const progress = Math.min((energyTask.progress / energyTask.target) * 100, 100);
            energyTaskProgress.style.width = `${progress}%`;
            energyTaskCount.textContent = energyTask.progress;
        }

        const streakCount = document.getElementById('streakCount');
        if (streakCount) {
            streakCount.textContent = this.gameState.state.streakCount;
        }

        this.updateNavigationBadges();
    }

    updateNavigationBadges() {
        const tasksBadge = document.getElementById('tasksBadge');
        const friendsBadge = document.getElementById('friendsBadge');
        const investBadge = document.getElementById('investBadge');
        
        let availableTasks = 0;
        Object.values(this.gameState.state.tasks).forEach(task => {
            if (task.progress >= (task.target || 1) && !task.completed) {
                availableTasks++;
            }
        });
        
        if (tasksBadge) {
            if (availableTasks > 0) {
                tasksBadge.textContent = availableTasks;
                tasksBadge.classList.remove('hidden');
            } else {
                tasksBadge.classList.add('hidden');
            }
        }

        let affordableInvestments = 0;
        ['energyCapacity', 'energyRegen', 'coinsPerTap'].forEach(boosterType => {
            if (this.gameState.canPurchaseBooster(boosterType)) {
                affordableInvestments++;
            }
        });

        if (investBadge) {
            if (affordableInvestments > 0) {
                investBadge.classList.remove('hidden');
            } else {
                investBadge.classList.add('hidden');
            }
        }
    }

    shareReferralCode() {
        const referralCode = document.getElementById('referralCode').textContent;
        
        if (navigator.share) {
            navigator.share({
                title: 'Join NZI Blitzkrieg!',
                text: `Join me in the ultimate tap-to-earn experience! Use code: ${referralCode}`,
                url: window.location.href
            });
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(`Join me in NZI Blitzkrieg! Use code: ${referralCode} - ${window.location.href}`);
            
            const message = document.createElement('div');
            message.className = 'floating-coin';
            message.textContent = 'Referral code copied!';
            message.style.color = '#00FF88';
            message.style.left = '50%';
            message.style.top = '50%';
            message.style.transform = 'translate(-50%, -50%)';
            
            if (this.elements.floatingCoins) {
                this.elements.floatingCoins.appendChild(message);
                setTimeout(() => {
                    if (message.parentNode) {
                        message.parentNode.removeChild(message);
                    }
                }, 2500);
            }
        }
    }

    updateAllDisplays() {
        this.gameState.updateAllDisplays();
        this.updateTasksDisplay();
        this.updateNavigationBadges();
    }
}

// Global game instance
let modernGame = null;

// Initialize game function
function initializeGame() {
    try {
        console.log('Initializing game...');
        modernGame = new ModernGameUI();
        window.modernGame = modernGame;
        console.log('Game initialized successfully');
    } catch (error) {
        console.error('Failed to initialize game:', error);
    }
}

// Multiple initialization approaches for maximum compatibility
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeGame);
} else {
    setTimeout(initializeGame, 100);
}

// Save game state before page unload
window.addEventListener('beforeunload', () => {
    if (modernGame && modernGame.gameState) {
        modernGame.gameState.saveGame();
    }
});

// Save when page becomes hidden
document.addEventListener('visibilitychange', () => {
    if (modernGame && modernGame.gameState && document.visibilityState === 'hidden') {
        modernGame.gameState.saveGame();
    }
});

console.log('App.js loaded successfully');