let currentView = 'all';
let activeFilters = new Set(['all']);
let showHidden = false;
let showCompleted = false;

// Move assignmentMap to the top level so it's available to all functions
const assignmentMap = {
    'Unassigned': 0,
    'Magenta': 1,
    'Orange': 2,
    'Red': 3,
    'Blue': 4,
    'Green': 5,
    'Cyan': 6
};

// Add these at the top level with other constants
const defaultLabels = {
    'all': 'All',
    '0': 'Unassigned',
    '1': 'Magenta',
    '2': 'Orange',
    '3': 'Red',
    '4': 'Blue',
    '5': 'Green',
    '6': 'Cyan'
};

const assignments = ['Unassigned', 'Magenta', 'Orange', 'Red', 'Blue', 'Green', 'Cyan'];

let customLabels = JSON.parse(localStorage.getItem('customLabels')) || {};

// Add at the top with other constants
const SOUNDS = {
    progress: new Audio('/static/sounds/zap.mp3'),
    complete: new Audio('/static/sounds/success.mp3'),
    roomComplete: new Audio('/static/sounds/huge-success.mp3')
};

function saveFilters() {
    localStorage.setItem('activeFilters', JSON.stringify(Array.from(activeFilters)));
}

function loadFilters() {
    const savedFilters = localStorage.getItem('activeFilters');
    // Initialize with default 'all' if no saved filters
    if (savedFilters) {
        activeFilters = new Set(JSON.parse(savedFilters));
    } else {
        activeFilters = new Set(['all']);
    }
    
    // Always update filter button states
    document.querySelectorAll('.color-filter').forEach(filter => {
        const assignment = filter.dataset.assignment;
        if (activeFilters.has(assignment)) {
            filter.classList.add('active');
        } else {
            filter.classList.remove('active');
        }
    });
    
    // Always update task visibility
    updateTaskVisibility();
    
    // Apply any saved custom labels
    for (const [assignment, label] of Object.entries(customLabels)) {
        document.querySelectorAll(`.color-filter[data-assignment="${assignment}"] span`).forEach(span => {
            span.textContent = label;
        });
    }
}

function setView(view) {
    currentView = view;
    document.querySelectorAll('.view-controls button').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`button[onclick="setView('${view}')"]`).classList.add('active');
    
    document.querySelectorAll('.floor').forEach(floor => {
        if (view === 'all' || floor.dataset.floor === view) {
            floor.style.display = 'block';
        } else {
            floor.style.display = 'none';
        }
    });
}

function updateProgress(floor, room, task, progress) {
    return fetch('/api/update_progress', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            floor: floor,
            room: room,
            task: task,
            progress: progress
        })
    })
    .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // Update the progress bar immediately
            const progressBar = document.getElementById(`${floor}-${room}-${task}-progress`);
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
            }
            // Also update room and floor progress
            updateRoomAndFloorProgress(floor, room);
        }
        return data;
    });
}

function updateRoomAndFloorProgress(floor, room) {
    // Calculate room progress
    const roomTasks = document.querySelectorAll(`.task[data-floor="${floor}"][data-room="${room}"] .progress`);
    let roomTotal = 0;
    roomTasks.forEach(taskProgress => {
        roomTotal += parseInt(taskProgress.style.width) || 0;
    });
    const roomProgress = roomTasks.length > 0 ? roomTotal / roomTasks.length : 0;
    
    // Update room progress bar
    const roomProgressBar = document.getElementById(`${floor}-${room}-progress`);
    if (roomProgressBar) {
        roomProgressBar.style.width = `${roomProgress}%`;
    }
    
    // Calculate floor progress
    const floorRooms = document.querySelectorAll(`.floor[data-floor="${floor}"] .room-card`);
    let floorTotal = 0;
    floorRooms.forEach(roomCard => {
        const roomProgressBar = roomCard.querySelector('.progress');
        floorTotal += parseInt(roomProgressBar?.style.width) || 0;
    });
    const floorProgress = floorRooms.length > 0 ? floorTotal / floorRooms.length : 0;
    
    // Update floor progress bar
    const floorProgressBar = document.getElementById(`${floor}-progress`);
    if (floorProgressBar) {
        floorProgressBar.style.width = `${floorProgress}%`;
    }
}

function loadProgress() {
    return fetch('/api/get_progress')
        .then(response => response.json())
        .then(data => {
            console.log('Progress data:', data);
            for (const floor in data) {
                let floorTotal = 0;
                let floorCount = 0;
                
                for (const room in data[floor]) {
                    let roomTotal = 0;
                    let roomCount = 0;
                    
                    for (const task in data[floor][room].tasks) {
                        const taskData = data[floor][room].tasks[task];
                        const progress = taskData.progress;
                        const assignment = taskData.assignment;
                        
                        const progressBar = document.getElementById(`${floor}-${room}-${task}-progress`);
                        const taskIcon = document.querySelector(`.task[data-floor="${floor}"][data-room="${room}"][data-task="${task}"] .task-header i`);
                        
                        if (progressBar) {
                            progressBar.style.width = `${progress}%`;
                            roomTotal += progress;
                            roomCount++;
                        }
                        
                        if (taskIcon) {
                            // Remove any existing assignment classes
                            taskIcon.classList.remove('assigned-0', 'assigned-1', 'assigned-2', 'assigned-3', 'assigned-4', 'assigned-5', 'assigned-6');
                            // Add current assignment class
                            taskIcon.classList.add(`assigned-${assignment}`);
                            // Update the tooltip text with custom label if it exists
                            const assignmentStr = assignment.toString();
                            const label = customLabels[assignmentStr] || defaultLabels[assignmentStr];
                            taskIcon.setAttribute('data-assignment', label);
                        }
                    }
                    
                    const roomProgress = roomCount > 0 ? roomTotal / roomCount : 0;
                    const roomProgressBar = document.getElementById(`${floor}-${room}-progress`);
                    if (roomProgressBar) {
                        roomProgressBar.style.width = `${roomProgress}%`;
                        floorTotal += roomProgress;
                        floorCount++;
                    }
                }
                
                const floorProgress = floorCount > 0 ? floorTotal / floorCount : 0;
                const floorProgressBar = document.getElementById(`${floor}-progress`);
                if (floorProgressBar) {
                    floorProgressBar.style.width = `${floorProgress}%`;
                }
            }
        })
        .catch(error => {
            console.error('Error loading progress:', error);
        });
}

function resetTasks() {
    fetch('/api/reset_tasks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Tasks reset successful:', data);
        loadProgress();  // Reload progress bars after reset
    })
    .catch(error => {
        console.error('Error resetting tasks:', error);
    });
}

function resetRoom(floor, room) {
    fetch('/api/reset_room', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            floor: floor,
            room: room
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Room reset successful:', data);
        loadProgress();
    })
    .catch(error => {
        console.error('Error resetting room:', error);
    });
}

function updateAssignment(floor, room, task, assignment) {
    return fetch('/api/update_assignment', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            floor: floor,
            room: room,
            task: task,
            assignment: assignment
        })
    });
}

function updateTaskVisibility() {
    const tasks = document.querySelectorAll('.task');
    const roomsWithMatchingTasks = new Set();
    
    tasks.forEach(task => {
        const taskIcon = task.querySelector('.task-header i');
        const currentClass = Array.from(taskIcon.classList)
            .find(className => className.startsWith('assigned-'));
        const currentAssignment = currentClass ? currentClass.split('-')[1] : '0';
        const progressBar = task.querySelector('.progress');
        const isCompleted = parseInt(progressBar.style.width) === 100;
        
        // Check if task should be visible based on filters and completion
        let isVisible = activeFilters.has('all') || activeFilters.has(currentAssignment);
        if (isCompleted && !showCompleted) {
            isVisible = false;
        }
        
        if (isVisible) {
            task.style.display = '';
            // Keep track of rooms that have matching tasks
            const floor = task.dataset.floor;
            const room = task.dataset.room;
            roomsWithMatchingTasks.add(`${floor}-${room}`);
        } else {
            task.style.display = 'none';
        }
    });

    // Update room visibility based on whether they have any matching tasks
    const roomCards = document.querySelectorAll('.room-card');
    roomCards.forEach(card => {
        const floor = card.closest('.floor').dataset.floor;
        const room = card.querySelector('h3').textContent.trim();
        const roomKey = `${floor}-${room}`;
        
        // First check if room should be hidden by filter
        if (!activeFilters.has('all') && !roomsWithMatchingTasks.has(roomKey)) {
            card.style.display = 'none';
            return;
        }
        
        // Then check if room is hidden (only if it passed the filter check)
        if (card.classList.contains('is-hidden') && !showHidden) {
            card.style.display = 'none';
        } else {
            card.style.display = '';
        }
    });
}

// Add these new functions
function showContextMenu(e, colorFilter) {
    e.preventDefault();
    const menu = document.getElementById('colorLabelMenu');
    const input = document.getElementById('labelInput');
    const assignment = colorFilter.dataset.assignment;
    
    // Position the menu at the click location
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    // Set the current label in the input
    input.value = customLabels[assignment] || defaultLabels[assignment];
    
    // Store the current assignment for use in apply/reset
    menu.dataset.currentAssignment = assignment;
    
    // Show the menu
    menu.classList.add('active');
    input.focus();
}

function applyLabel() {
    const menu = document.getElementById('colorLabelMenu');
    const input = document.getElementById('labelInput');
    
    if (menu.dataset.editingTitle === 'true') {
        // Updating dashboard title
        const newTitle = input.value.trim() || 'Cleaning Dashboard';
        document.querySelector('.dashboard-title').textContent = newTitle;
        localStorage.setItem('dashboardTitle', newTitle);
        delete menu.dataset.editingTitle;
    } else {
        // Existing color label update logic
        const assignment = menu.dataset.currentAssignment;
        customLabels[assignment] = input.value;
        localStorage.setItem('customLabels', JSON.stringify(customLabels));
        document.querySelectorAll(`.color-filter[data-assignment="${assignment}"] span`).forEach(span => {
            span.textContent = input.value;
        });
    }
    
    hideContextMenu();
}

function resetLabel() {
    const menu = document.getElementById('colorLabelMenu');
    
    if (menu.dataset.editingTitle === 'true') {
        // Reset dashboard title
        const defaultTitle = 'Cleaning Dashboard';
        document.querySelector('.dashboard-title').textContent = defaultTitle;
        localStorage.removeItem('dashboardTitle');
        delete menu.dataset.editingTitle;
    } else {
        // Existing color label reset logic
        const assignment = menu.dataset.currentAssignment;
        delete customLabels[assignment];
        localStorage.setItem('customLabels', JSON.stringify(customLabels));
        document.querySelectorAll(`.color-filter[data-assignment="${assignment}"] span`).forEach(span => {
            span.textContent = defaultLabels[assignment];
        });
    }
    
    hideContextMenu();
}

function hideContextMenu() {
    const menu = document.getElementById('colorLabelMenu');
    menu.classList.remove('active');
}

function showTitleContextMenu(e, titleElement) {
    e.preventDefault();
    const menu = document.getElementById('colorLabelMenu');
    const input = document.getElementById('labelInput');
    
    // Position the menu at the click location
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    
    // Set the current title in the input
    input.value = dashboardTitle;
    
    // Mark this as a title edit
    menu.dataset.editingTitle = 'true';
    
    // Show the menu
    menu.classList.add('active');
    input.focus();
}

// Add sound playing functions
function playProgressSound() {
    SOUNDS.progress.currentTime = 0;  // Reset sound to start
    SOUNDS.progress.play().catch(e => console.log('Sound play failed:', e));
}

function playCompleteSound() {
    SOUNDS.complete.currentTime = 0;
    SOUNDS.complete.play().catch(e => console.log('Sound play failed:', e));
}

// Add new function to check room completion
function isRoomComplete(floor, room) {
    const tasks = document.querySelectorAll(`.task[data-floor="${floor}"][data-room="${room}"]`);
    for (const task of tasks) {
        const progressBar = task.querySelector('.progress');
        const progress = parseInt(progressBar.style.width) || 0;
        if (progress !== 100) {
            return false;
        }
    }
    return true;
}

// Add new function to play room completion sound
function playRoomCompleteSound() {
    SOUNDS.roomComplete.currentTime = 0;
    SOUNDS.roomComplete.play().catch(e => console.log('Sound play failed:', e));
}

function toggleShowHidden() {
    showHidden = !showHidden;
    const btn = document.getElementById('show-hidden-btn');
    btn.innerHTML = `<i class="fas fa-eye${showHidden ? '' : '-slash'}"></i> ${showHidden ? 'Hide Hidden' : 'Show Hidden'}`;
    updateRoomVisibility();
}

function toggleRoomHidden(floor, room) {
    fetch('/api/toggle_room_hidden', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            floor: floor,
            room: room
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadProgress();
        }
    });
}

function resetHidden() {
    fetch('/api/reset_hidden', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            loadProgress();
            const menu = document.getElementById('showHiddenMenu');
            menu.style.display = 'none';
        }
    });
}

function updateRoomVisibility() {
    fetch('/api/get_progress')
        .then(response => response.json())
        .then(data => {
            const roomCards = document.querySelectorAll('.room-card');
            roomCards.forEach(card => {
                const floor = card.closest('.floor').dataset.floor;
                const room = card.querySelector('h3').textContent.trim();
                const roomData = data[floor]?.[room];
                const isHidden = roomData?.hidden === 1;
                
                // Update hide button text
                const hideButton = card.querySelector('.btn-hide');
                if (hideButton) {
                    hideButton.innerHTML = isHidden ? 
                        '<i class="fas fa-eye"></i> Show Room' : 
                        '<i class="fas fa-eye-slash"></i> Hide Room';
                }
                
                // Update hidden state class
                if (isHidden) {
                    card.classList.add('is-hidden');
                } else {
                    card.classList.remove('is-hidden');
                }
                
                // Let updateTaskVisibility handle actual visibility
                updateTaskVisibility();
            });
        });
}

// Add context menu for show hidden button
const showHiddenBtn = document.getElementById('show-hidden-btn');
if (showHiddenBtn) {
    showHiddenBtn.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        const menu = document.getElementById('showHiddenMenu');
        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
    });
}

// Add to existing document click handler for context menus
document.addEventListener('click', function(e) {
    const showHiddenMenu = document.getElementById('showHiddenMenu');
    if (showHiddenMenu && !e.target.closest('#showHiddenMenu') && !e.target.closest('#show-hidden-btn')) {
        showHiddenMenu.style.display = 'none';
    }
});

// Update the loadProgress wrapper to only call updateRoomVisibility in dashboard view
const originalLoadProgress = loadProgress;
loadProgress = function() {
    return originalLoadProgress().then(() => {
        if (document.getElementById('show-hidden-btn')) {
            updateRoomVisibility();
        }
    });
};

// Initialize title handling
function initializeTitleHandling() {
    const titleElement = document.querySelector('.dashboard-title');
    if (titleElement) {
        // Load saved title if it exists
        const savedTitle = localStorage.getItem('dashboardTitle');
        if (savedTitle) {
            titleElement.textContent = savedTitle;
        }

        // Add context menu handler
        titleElement.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            const menu = document.getElementById('colorLabelMenu');
            const input = document.getElementById('labelInput');
            
            // Position the menu at the click location
            menu.style.display = 'block';
            menu.style.left = e.pageX + 'px';
            menu.style.top = e.pageY + 'px';
            
            // Set the current title in the input
            input.value = titleElement.textContent;
            
            // Mark this as a title edit
            menu.dataset.editingTitle = 'true';
            
            // Show the menu
            menu.classList.add('active');
            input.focus();
        });
    }
}

// Add title initialization to DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize title handling
    initializeTitleHandling();
    
    // First load the progress to ensure all tasks are properly initialized
    loadProgress().then(() => {
        // Then load and apply filters
        loadFilters();
        
        // Initialize task click handlers
        initializeTaskHandlers();
    });
});

function initializeTaskHandlers() {
    // Initialize task handlers
    document.querySelectorAll('.task').forEach(task => {
        // Remove any existing event listeners
        const newTask = task.cloneNode(true);
        task.parentNode.replaceChild(newTask, task);
        task = newTask;

        const taskIcon = task.querySelector('.task-header i');
        
        // Assignment click handler
        if (taskIcon) {
            taskIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const floor = task.dataset.floor;
                const room = task.dataset.room;
                const taskName = task.dataset.task;
                
                // Get current assignment from the class name instead of data attribute
                const currentClass = Array.from(taskIcon.classList)
                    .find(className => className.startsWith('assigned-'));
                const currentAssignment = currentClass ? parseInt(currentClass.split('-')[1]) : 0;
                const newAssignment = (currentAssignment + 1) % 7;
                
                updateAssignment(floor, room, taskName, newAssignment)
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            // Remove old assignment class
                            taskIcon.classList.remove(`assigned-${currentAssignment}`);
                            // Add new assignment class
                            taskIcon.classList.add(`assigned-${newAssignment}`);
                            
                            // Update the tooltip text with custom label if it exists
                            const label = customLabels[newAssignment.toString()] || defaultLabels[newAssignment.toString()];
                            taskIcon.setAttribute('data-assignment', label);
                        }
                    })
                    .catch(error => {
                        console.error('Error updating assignment:', error);
                    });
            });
        }
        
        // Progress click handler
        task.addEventListener('click', (e) => {
            if (e.target.closest('.task-header i')) return;
            e.preventDefault();
            const floor = task.dataset.floor;
            const room = task.dataset.room;
            const taskName = task.dataset.task;
            const progressBar = document.getElementById(`${floor}-${room}-${taskName}-progress`);
            
            if (!progressBar) {
                console.error('Progress bar not found:', `${floor}-${room}-${taskName}-progress`);
                return;
            }
            
            const currentProgress = parseInt(progressBar.style.width) || 0;
            const newProgress = (currentProgress + 25) % 125;
            
            // Play appropriate sound(s) and handle completion
            if (newProgress === 100) {
                handleTaskCompletion(task, floor, room);
            } else if (newProgress !== 0) {
                playProgressSound();
            }
            
            updateProgress(floor, room, taskName, newProgress)
                .then(() => {
                    // Update progress bar immediately
                    progressBar.style.width = `${newProgress}%`;
                    // Update room progress
                    updateRoomAndFloorProgress(floor, room);
                })
                .catch(error => {
                    console.error('Error updating progress:', error);
                });
        });
    });

    // Initialize color filters
    initializeColorFilters();

    // Initialize context menu handlers
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#colorLabelMenu')) {
            hideContextMenu();
        }
    });

    // Initialize label input if it exists
    const labelInput = document.getElementById('labelInput');
    if (labelInput) {
        labelInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                applyLabel();
            } else if (e.key === 'Escape') {
                hideContextMenu();
            }
        });
    }
}

// Add a jQuery-like contains selector since we're using vanilla JS
Element.prototype.matches = Element.prototype.matches || Element.prototype.msMatchesSelector;
Element.prototype.closest = Element.prototype.closest || function (selector) {
    var el = this;
    while (el) {
        if (el.matches(selector)) {
            return el;
        }
        el = el.parentElement;
    }
    return null;
};

// Add contains selector for case-insensitive text content matching
HTMLElement.prototype.contains = function(text) {
    return this.textContent.trim().toLowerCase() === text.toLowerCase();
};

// Add title context menu handler
const dashboardTitle = document.querySelector('.dashboard-title');
if (dashboardTitle) {
    dashboardTitle.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        const menu = document.getElementById('colorLabelMenu');
        const input = document.getElementById('labelInput');
        
        // Position the menu at the click location
        menu.style.display = 'block';
        menu.style.left = e.pageX + 'px';
        menu.style.top = e.pageY + 'px';
        
        // Set the current title in the input
        input.value = dashboardTitle.textContent;
        
        // Mark this as a title edit
        menu.dataset.editingTitle = 'true';
        
        // Show the menu
        menu.classList.add('active');
        input.focus();
    });
}

// Add to DOMContentLoaded to initialize the title
document.addEventListener('DOMContentLoaded', () => {
    // Load saved title if it exists
    const savedTitle = localStorage.getItem('dashboardTitle');
    if (savedTitle) {
        const titleElement = document.querySelector('.dashboard-title');
        if (titleElement) {
            titleElement.textContent = savedTitle;
        }
    }
    
    // Rest of the initialization code...
});

// Update the color filter click handler
function initializeColorFilters() {
    const colorFilters = document.querySelectorAll('.color-filter');
    if (colorFilters.length > 0) {
        colorFilters.forEach(filter => {
            filter.addEventListener('click', () => {
                const assignment = filter.dataset.assignment;
                
                if (assignment === 'all') {
                    if (activeFilters.has('all')) {
                        activeFilters.clear();
                        document.querySelectorAll('.color-filter').forEach(f => f.classList.remove('active'));
                    } else {
                        activeFilters.clear();
                        activeFilters.add('all');
                        document.querySelectorAll('.color-filter').forEach(f => f.classList.remove('active'));
                        filter.classList.add('active');
                    }
                } else {
                    activeFilters.delete('all');
                    document.querySelector('.color-filter[data-assignment="all"]').classList.remove('active');
                    
                    if (activeFilters.has(assignment)) {
                        activeFilters.delete(assignment);
                        filter.classList.remove('active');
                        
                        if (activeFilters.size === 0) {
                            activeFilters.add('all');
                            document.querySelector('.color-filter[data-assignment="all"]').classList.add('active');
                        }
                    } else {
                        activeFilters.add(assignment);
                        filter.classList.add('active');
                    }
                }
                
                saveFilters();  // Save filter state
                updateTaskVisibility();
            });

            // Add context menu
            filter.addEventListener('contextmenu', (e) => showContextMenu(e, filter));
        });
    }
}

function toggleShowCompleted() {
    showCompleted = !showCompleted;
    const btn = document.getElementById('show-completed-btn');
    btn.innerHTML = `<i class="fas fa-check"></i> ${showCompleted ? 'Hide Completed' : 'Show Completed'}`;
    updateTaskVisibility();
}

function createParticles(task) {
    const rect = task.getBoundingClientRect();
    const numParticles = 25;  // Increased number of particles
    
    for (let i = 0; i < numParticles; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        
        // Random angle and increased distance
        const angle = (Math.random() * Math.PI * 2);
        const distance = 100 + Math.random() * 200;  // Increased distance range
        
        // Calculate final position
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        // Set particle position and animation
        particle.style.left = (rect.left + rect.width / 2) + 'px';
        particle.style.top = (rect.top + rect.height / 2) + 'px';
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        document.body.appendChild(particle);
        
        // Remove particle after animation (increased to match new animation duration)
        setTimeout(() => particle.remove(), 800);
    }
}

// Update the task completion handler
function handleTaskCompletion(task, floor, room) {
    // Add shake animation to task
    task.classList.add('task-complete-shake');
    
    // Remove animation class and start particle effect
    setTimeout(() => {
        task.classList.remove('task-complete-shake');
        task.classList.add('exploding');
        createParticles(task);
        
        // Hide task after explosion
        setTimeout(() => {
            task.classList.remove('exploding');
            if (!showCompleted) {
                task.style.display = 'none';
                // Check if room should be hidden (no visible tasks)
                const visibleTasks = Array.from(task.closest('.tasks').querySelectorAll('.task'))
                    .filter(t => t.style.display !== 'none');
                if (visibleTasks.length === 0) {
                    const roomCard = task.closest('.room-card');
                    if (roomCard) {
                        roomCard.style.display = 'none';
                    }
                }
            }
        }, 600);
    }, 600);
    
    // Play task completion sounds
    playProgressSound();
    setTimeout(() => {
        playCompleteSound();
        // Check if room is complete after a short delay
        setTimeout(() => {
            if (isRoomComplete(floor, room)) {
                playRoomCompleteSound();
                // Add shake animation to room card or container
                const roomCard = task.closest('.room-card') || task.closest('.room-view');
                if (roomCard) {
                    roomCard.classList.add('room-complete-shake');
                    // Remove animation class after it's done
                    setTimeout(() => roomCard.classList.remove('room-complete-shake'), 800);
                }
            }
        }, 300);
    }, 200);
} 