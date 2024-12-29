let currentView = 'all';
let activeFilters = new Set(['all']);
let showHidden = false;
let showCompleted = false;

// WebSocket connection
let ws;
function initWebSocket() {
    // Use secure WebSocket if the page is loaded over HTTPS
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    console.log('Connecting to WebSocket at:', wsUrl);
    ws = new WebSocket(wsUrl);

    ws.onopen = function() {
        console.log('WebSocket connected');
    };

    ws.onmessage = function(event) {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
    };

    ws.onclose = function() {
        console.log('WebSocket disconnected, attempting to reconnect...');
        // Try to reconnect every 5 seconds
        setTimeout(initWebSocket, 5000);
    };

    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
    };
}

function handleWebSocketMessage(data) {
    switch(data.action) {
        case 'updateProgress':
            // Update progress without sending back to server
            const taskElement = document.querySelector(`.task[data-floor="${data.floor}"][data-room="${data.room}"][data-task="${data.task}"]`);
            if (taskElement) {
                const progressBar = taskElement.querySelector('.progress');
                if (progressBar) {
                    const oldProgress = parseInt(progressBar.style.width) || 0;
                    progressBar.style.width = `${data.progress}%`;
                    
                    // Play sounds and show animations
                    if (data.progress === 100) {
                        playCompleteSound();
                        handleTaskCompletion(taskElement, data.floor, data.room);
                    } else if (data.progress > oldProgress) {
                        playProgressSound();
                    }
                }
            }
            break;
            
        case 'updateAssignment':
            const taskIcon = document.querySelector(`.task[data-floor="${data.floor}"][data-room="${data.room}"][data-task="${data.task}"] .task-header i`);
            if (taskIcon) {
                // Remove old assignment class
                taskIcon.classList.remove(`assigned-${data.oldAssignment}`);
                // Add new assignment class
                taskIcon.classList.add(`assigned-${data.newAssignment}`);
                // Update tooltip
                const label = customLabels[data.newAssignment.toString()] || defaultLabels[data.newAssignment.toString()];
                taskIcon.setAttribute('data-assignment', label);
            }
            break;
            
        case 'navigateToRoom':
            // Handle room navigation from other clients
            if (data.floor === 'dashboard') {
                window.location.href = '/';
            } else {
                window.location.href = `/room/${data.floor}/${data.room}`;
            }
            break;
            
        case 'setView':
            setView(data.view, true);  // true means don't broadcast
            break;
            
        case 'toggleShowCompleted':
            toggleShowCompleted(true);  // true means don't broadcast
            break;
            
        case 'toggleShowHidden':
            toggleShowHidden(true);  // true means don't broadcast
            break;
            
        case 'resetRoom':
            resetRoom(data.floor, data.room, true);  // true means don't broadcast
            break;
            
        case 'resetTasks':
            resetTasks(true);  // true means don't broadcast
            break;
            
        case 'resetHidden':
            resetHidden(true);  // true means don't broadcast
            break;
    }
}

function broadcastAction(action, data = {}) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            action,
            ...data
        }));
    }
}

// Move assignmentMap to the top level so it's available to all functions
const assignmentMap = {
    'Unassigned': 0,
    'Assignment1': 1,
    'Assignment2': 2,
    'Assignment3': 3,
    'Assignment4': 4,
    'Assignment5': 5,
    'Assignment6': 6
};

// Add these at the top level with other constants
const defaultLabels = {
    'all': 'All',
    '0': 'Unassigned'
};

const assignments = ['Unassigned', 'Assignment1', 'Assignment2', 'Assignment3', 'Assignment4', 'Assignment5', 'Assignment6'];

let customLabels = JSON.parse(localStorage.getItem('customLabels')) || {};

// Add at the top with other constants
const SOUNDS = {
    progress: new Audio('/static/sounds/zap.mp3'),
    complete: new Audio('/static/sounds/success.mp3'),
    roomComplete: new Audio('/static/sounds/huge-success.mp3')
};

// Preload sounds
function preloadSounds() {
    for (const sound of Object.values(SOUNDS)) {
        sound.preload = 'auto';  // Force preload
        sound.volume = 1.0;  // Ensure volume is set
        sound.load();  // Start loading
        // Try to play (and immediately pause) to handle autoplay restrictions
        sound.play().then(() => {
            sound.pause();
            sound.currentTime = 0;
        }).catch(() => {
            console.log('Sound preload play failed - this is normal if no user interaction yet');
        });
    }
}

// Optimize sound playback
function playSound(sound) {
    // Clone the audio to allow overlapping sounds
    const clone = sound.cloneNode();
    clone.volume = sound.volume;
    clone.playbackRate = sound.playbackRate;
    
    // Play immediately
    const playPromise = clone.play();
    
    // Handle play promise to avoid errors
    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log('Sound play failed:', error);
            // Try to play original sound as fallback
            sound.play().catch(e => console.log('Fallback sound play failed:', e));
        });
    }
}

function playProgressSound() {
    playSound(SOUNDS.progress);
}

function playCompleteSound() {
    playSound(SOUNDS.complete);
}

function playRoomCompleteSound() {
    playSound(SOUNDS.roomComplete);
}

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

function setView(view, fromBroadcast = false) {
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

    // Only broadcast if this wasn't triggered by a broadcast
    if (!fromBroadcast) {
        broadcastAction('setView', { view });
    }
}

async function updateProgress(floor, room, task, progress, fromBroadcast = false) {
    if (!fromBroadcast) {
        try {
            const response = await fetch('/api/update_progress', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ floor, room, task, progress })
            });
            
            if (response.ok) {
                // Find the task's progress bar using the task element itself
                const taskElement = document.querySelector(`.task[data-floor="${floor}"][data-room="${room}"][data-task="${task}"]`);
                
                if (taskElement && progress === 100) {
                    // Handle completion animations and state changes
                    handleTaskCompletion(taskElement, floor, room);
                }
                
                // Broadcast the update to other clients
                broadcastAction('updateProgress', { floor, room, task, progress });
            }
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    }
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

function resetTasks(fromBroadcast = false) {
    if (!fromBroadcast) {
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
            // Broadcast the reset to other clients
            broadcastAction('resetTasks');
            // Load progress after reset
            loadProgress();
        })
        .catch(error => {
            console.error('Error resetting tasks:', error);
        });
    } else {
        // If this was triggered by a broadcast, just reload progress
        loadProgress();
    }
}

function resetRoom(floor, room, fromBroadcast = false) {
    if (!fromBroadcast) {
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
            
            // First reset all task states in this room
            document.querySelectorAll(`.task[data-floor="${floor}"][data-room="${room}"]`).forEach(task => {
                // Remove animation classes
                task.classList.remove('exploding', 'task-complete-shake');
                // Reset display style
                task.style.display = '';
                // Reset progress bar
                const progressBar = task.querySelector('.progress');
                if (progressBar) {
                    progressBar.style.width = '0%';
                }
            });
            
            // Then load progress to update any other states
            loadProgress().then(() => {
                // Update task visibility to handle filters
                updateTaskVisibility();
            });

            // Broadcast the reset to other clients
            broadcastAction('resetRoom', { floor, room });
        })
        .catch(error => {
            console.error('Error resetting room:', error);
        });
    } else {
        // If this was triggered by a broadcast, reset the room locally
        document.querySelectorAll(`.task[data-floor="${floor}"][data-room="${room}"]`).forEach(task => {
            // Remove animation classes
            task.classList.remove('exploding', 'task-complete-shake');
            // Reset display style
            task.style.display = '';
            // Reset progress bar
            const progressBar = task.querySelector('.progress');
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        });
        
        // Then load progress to update any other states
        loadProgress().then(() => {
            // Update task visibility to handle filters
            updateTaskVisibility();
        });
    }
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
    document.querySelectorAll('.task').forEach(task => {
        const progressBar = task.querySelector('.progress');
        const isCompleted = progressBar && progressBar.style.width === '100%';
        const taskIcon = task.querySelector('.task-header i');
        const currentClass = Array.from(taskIcon?.classList || [])
            .find(className => className.startsWith('assigned-'));
        const currentAssignment = currentClass ? currentClass.split('-')[1] : '0';
        
        // Check both completion and filter status
        const matchesFilter = activeFilters.has('all') || activeFilters.has(currentAssignment);
        
        // Hide instead of remove, so we can show again when filter changes
        task.style.display = (!isCompleted || showCompleted) && matchesFilter ? '' : 'none';
    });

    // Update room visibility based on task completion, filters, and hidden status
    document.querySelectorAll('.room-card').forEach(room => {
        const tasks = room.querySelectorAll('.task');
        const hasVisibleTasks = Array.from(tasks).some(task => task.style.display !== 'none');
        const isHidden = room.classList.contains('is-hidden');
        
        // Show room if:
        // 1. It has visible tasks AND
        // 2. Either showHidden is true OR the room is not hidden
        room.style.display = hasVisibleTasks && (showHidden || !isHidden) ? '' : 'none';
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

function toggleShowHidden(fromBroadcast = false) {
    showHidden = !showHidden;
    const btn = document.getElementById('show-hidden-btn');
    btn.innerHTML = `<i class="fas fa-eye${showHidden ? '' : '-slash'}"></i> ${showHidden ? 'Hide Hidden' : 'Show Hidden'}`;
    updateRoomVisibility();

    if (!fromBroadcast) {
        broadcastAction('toggleShowHidden');
    }
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

function resetHidden(fromBroadcast = false) {
    if (!fromBroadcast) {
        fetch('/api/reset_hidden', {
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
            console.log('Hidden rooms reset successful:', data);
            // Remove is-hidden class from all rooms
            document.querySelectorAll('.room-card.is-hidden').forEach(room => {
                room.classList.remove('is-hidden');
            });
            // Update visibility to show newly unhidden rooms
            updateTaskVisibility();
            // Broadcast the reset to other clients
            broadcastAction('resetHidden');
        })
        .catch(error => {
            console.error('Error resetting hidden rooms:', error);
        });
    }
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
    // Initialize WebSocket first
    initWebSocket();
    
    // Preload sounds
    preloadSounds();
    
    // Initialize title handling
    initializeTitleHandling();
    
    // Load showCompleted state from localStorage, default to false if not set
    const savedShowCompleted = localStorage.getItem('showCompleted');
    showCompleted = savedShowCompleted === 'true';
    const btn = document.getElementById('show-completed-btn');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-check"></i> ${showCompleted ? 'Hide Completed' : 'Show Completed'}`;
    }
    
    // First load the progress to ensure all tasks are properly initialized
    loadProgress().then(() => {
        // Then load and apply filters
        loadFilters();
        
        // Initialize task handlers
        initializeTaskHandlers();
        
        // Update task visibility based on showCompleted state
        updateTaskVisibility();
    });
});

function initializeTaskHandlers() {
    // Initialize task handlers
    document.querySelectorAll('.task').forEach(task => {
        // Common click handler function
        const handleTaskClick = async (e) => {
            // Don't handle progress clicks if clicking the icon
            if (e.target.closest('.task-header i')) return;
            
            // Only prevent clicks during the completion animation
            if (task.classList.contains('task-complete-shake') || 
                task.classList.contains('exploding')) {
                return;
            }

            const progressBar = task.querySelector('.progress');
            if (!progressBar) return;

            const currentWidth = parseInt(progressBar.style.width) || 0;
            // Reset to 0 if task is completed, otherwise increment by 20
            const newProgress = currentWidth === 100 ? 0 : currentWidth + 20;
            
            // Play sounds immediately
            if (newProgress === 100) {
                playCompleteSound();
                // Start shake animation immediately
                task.classList.add('task-complete-shake');
            } else if (newProgress > currentWidth) {
                playProgressSound();
            }
            
            // Update progress bar immediately for better feedback
            progressBar.style.width = `${newProgress}%`;
            
            // Get floor and room info from data attributes
            const floor = task.dataset.floor;
            const room = task.dataset.room;
            const taskId = task.dataset.task;

            // Update progress in background
            updateProgress(floor, room, taskId, newProgress);
        };

        // Left click handler
        task.addEventListener('click', handleTaskClick);
        
        // Right click handler
        task.addEventListener('contextmenu', (e) => {
            e.preventDefault();  // Prevent default context menu
            handleTaskClick(e);
        });

        // Assignment icon click handler
        const taskIcon = task.querySelector('.task-header i');
        if (taskIcon) {
            taskIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                
                // Get current assignment from the class name
                const currentClass = Array.from(taskIcon.classList)
                    .find(className => className.startsWith('assigned-'));
                const currentAssignment = currentClass ? parseInt(currentClass.split('-')[1]) : 0;
                const newAssignment = (currentAssignment + 1) % 7;
                
                // Get task info from data attributes
                const floor = task.dataset.floor;
                const room = task.dataset.room;
                const taskId = task.dataset.task;
                
                updateAssignment(floor, room, taskId, newAssignment)
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
                            
                            // Broadcast the assignment change
                            broadcastAction('updateAssignment', {
                                floor,
                                room,
                                task: taskId,
                                oldAssignment: currentAssignment,
                                newAssignment
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error updating assignment:', error);
                    });
            });
        }
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
HTMLElement.prototype.textContains = function(text) {
    if (typeof text !== 'string') return false;
    return this.textContent.trim().toLowerCase().includes(text.toLowerCase());
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
    document.querySelectorAll('.color-filter').forEach(filter => {
        filter.addEventListener('click', () => {
            const assignment = filter.dataset.assignment;
            
            // Toggle active state
            if (assignment === 'all') {
                // If clicking 'All', make it the only active filter
                activeFilters.clear();
                activeFilters.add('all');
                document.querySelectorAll('.color-filter').forEach(f => {
                    f.classList.toggle('active', f === filter);
                });
            } else {
                // Remove 'all' filter when clicking specific color
                activeFilters.delete('all');
                document.querySelector('.color-filter[data-assignment="all"]')
                    ?.classList.remove('active');
                
                // Toggle this filter
                filter.classList.toggle('active');
                if (filter.classList.contains('active')) {
                    activeFilters.add(assignment);
                } else {
                    activeFilters.delete(assignment);
                    // If no filters active, activate 'all'
                    if (activeFilters.size === 0) {
                        activeFilters.add('all');
                        document.querySelector('.color-filter[data-assignment="all"]')
                            ?.classList.add('active');
                    }
                }
            }
            
            // Update visibility
            updateTaskVisibility();
        });
    });
}

function toggleShowCompleted(fromBroadcast = false) {
    showCompleted = !showCompleted;
    // Save to localStorage immediately when toggled
    localStorage.setItem('showCompleted', showCompleted);
    
    const btn = document.getElementById('show-completed-btn');
    btn.innerHTML = `<i class="fas fa-check"></i> ${showCompleted ? 'Hide Completed' : 'Show Completed'}`;
    updateTaskVisibility();

    if (!fromBroadcast) {
        broadcastAction('toggleShowCompleted');
    }
}

function createParticles(element, isRoom = false) {
    if (!element || !element.isConnected) return;
    
    // Get or create particles container
    let container = document.getElementById('particles-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'particles-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const particleCount = isRoom ? 30 : 15;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = `particle ${isRoom ? 'room-particle' : ''}`;
        
        // Calculate random end position
        const angle = (Math.random() * 360) * (Math.PI / 180);
        const distance = isRoom ? Math.random() * 300 + 100 : Math.random() * 150 + 50;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        // Set initial position
        particle.style.left = `${centerX}px`;
        particle.style.top = `${centerY}px`;
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        container.appendChild(particle);
        
        // Clean up particle after animation
        particle.addEventListener('animationend', () => {
            if (container.contains(particle)) {
                container.removeChild(particle);
            }
        });
    }
}

function checkRoomCompletion(floor, roomName) {
    const roomCard = document.querySelector(`.room-card[data-floor="${floor}"][data-room="${roomName}"]`);
    if (!roomCard) return;

    const tasks = roomCard.querySelectorAll('.task');
    const allComplete = Array.from(tasks).every(task => {
        const progressBar = task.querySelector('.progress');
        return progressBar && progressBar.style.width === '100%';
    });

    if (allComplete && !roomCard.classList.contains('exploding')) {
        playRoomCompleteSound();
        createParticles(roomCard, true);
        roomCard.classList.add('exploding');
        
        roomCard.addEventListener('animationend', () => {
            if (!showCompleted && roomCard.parentElement) {
                roomCard.parentElement.removeChild(roomCard);
            }
        });
    }
}

// Update the task completion handler
function handleTaskCompletion(task, floor, room) {
    const isDashboardView = !document.querySelector('.room-view');
    
    // Add shake animation first
    task.classList.add('task-complete-shake');

    // After shake animation (200ms)
    setTimeout(() => {
        task.classList.remove('task-complete-shake');

        // Create particles and start explosion
        if (isDashboardView) {
            if (task.isConnected) {
                createParticles(task);
                task.classList.add('exploding');
                
                // Always remove exploding class after animation
                task.addEventListener('animationend', () => {
                    task.classList.remove('exploding');
                    if (!showCompleted) {
                        task.style.display = 'none';
                    }
                }, { once: true });
                
                // Check room completion immediately
                const roomCard = task.closest('.room-card');
                if (roomCard) {
                    const tasks = roomCard.querySelectorAll('.task');
                    const allComplete = Array.from(tasks).every(t => {
                        const progressBar = t.querySelector('.progress');
                        return progressBar && progressBar.style.width === '100%';
                    });

                    if (allComplete && !roomCard.classList.contains('exploding')) {
                        setTimeout(() => {
                            playRoomCompleteSound();
                            createParticles(roomCard, true);
                            
                            // Wait for particles to mostly finish (800ms) before fading room
                            setTimeout(() => {
                                roomCard.classList.add('exploding');
                                
                                roomCard.addEventListener('animationend', () => {
                                    roomCard.classList.remove('exploding');
                                    if (!showCompleted) {
                                        roomCard.style.display = 'none';
                                    }
                                });
                            }, 800);
                        }, 300);
                    }
                }
            }
        } else {
            // Room view handling
            createParticles(task);
            task.classList.add('exploding');
            
            // Always remove exploding class after animation
            task.addEventListener('animationend', () => {
                task.classList.remove('exploding');
                if (!showCompleted) {
                    task.style.display = 'none';
                }
            }, { once: true });
            
            // Check if all tasks in room are complete
            const roomView = task.closest('.room-view');
            const tasks = roomView.querySelectorAll('.task');
            const allComplete = Array.from(tasks).every(t => {
                const progressBar = t.querySelector('.progress');
                return progressBar && progressBar.style.width === '100%';
            });

            if (allComplete) {
                // Wait for task explosion to finish
                setTimeout(() => {
                    // Play the huge success sound
                    playRoomCompleteSound();
                    
                    // Create explosion particles from each task
                    tasks.forEach(t => createParticles(t, true));
                    
                    // Create additional particles from corners and center
                    const corners = [
                        {x: 0, y: 0}, {x: window.innerWidth, y: 0},
                        {x: 0, y: window.innerHeight}, {x: window.innerWidth, y: window.innerHeight},
                        {x: window.innerWidth/2, y: window.innerHeight/2}
                    ];
                    corners.forEach(pos => createParticlesAtPosition(pos.x, pos.y, true));
                    
                    // Add explosion class to room view
                    roomView.classList.add('room-exploding');
                    
                    // Redirect to dashboard after animation
                    setTimeout(() => {
                        // Store showCompleted state in localStorage before redirect
                        localStorage.setItem('showCompleted', showCompleted);
                        // Broadcast navigation before redirecting
                        broadcastDashboardNavigation();
                        window.location.href = '/';
                    }, 1500);
                }, 600);
            }
        }
    }, 200);
}

// Add new function to create particles at specific position
function createParticlesAtPosition(x, y, isRoom = false) {
    let container = document.getElementById('particles-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'particles-container';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    
    const particleCount = isRoom ? 30 : 15;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = `particle ${isRoom ? 'room-particle' : ''}`;
        
        // Calculate random end position
        const angle = (Math.random() * 360) * (Math.PI / 180);
        const distance = isRoom ? Math.random() * 400 + 200 : Math.random() * 150 + 50;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;
        
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--tx', `${tx}px`);
        particle.style.setProperty('--ty', `${ty}px`);
        
        container.appendChild(particle);
        
        particle.addEventListener('animationend', () => {
            if (container.contains(particle)) {
                container.removeChild(particle);
            }
        });
    }
}

// Add function to broadcast room navigation
function broadcastRoomNavigation(floor, room) {
    broadcastAction('navigateToRoom', { floor, room });
}

// Add function to broadcast dashboard navigation
function broadcastDashboardNavigation() {
    broadcastAction('navigateToRoom', { floor: 'dashboard', room: 'dashboard' });
}

// Add history state handling
window.addEventListener('popstate', function(event) {
    // If we're on the dashboard, broadcast it
    if (window.location.pathname === '/') {
        broadcastDashboardNavigation();
    }
}); 