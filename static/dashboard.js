let currentView = 'all';
let activeFilters = new Set(['all']);

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

// Add to the top with other constants
let dashboardTitle = localStorage.getItem('dashboardTitle') || 'Cleaning Dashboard';

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
    });
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
                    
                    for (const task in data[floor][room]) {
                        const taskData = data[floor][room][task];
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
    tasks.forEach(task => {
        const taskIcon = task.querySelector('.task-header i');
        const assignmentText = taskIcon.getAttribute('data-assignment');
        const assignmentIndex = assignmentMap[assignmentText];
        
        if (activeFilters.has('all') || activeFilters.has(assignmentIndex.toString())) {
            task.classList.remove('hidden');
        } else {
            task.classList.add('hidden');
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
        dashboardTitle = input.value;
        localStorage.setItem('dashboardTitle', dashboardTitle);
        document.querySelector('.dashboard-title').textContent = dashboardTitle;
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
        dashboardTitle = 'Cleaning Dashboard';
        localStorage.removeItem('dashboardTitle');
        document.querySelector('.dashboard-title').textContent = dashboardTitle;
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

document.addEventListener('DOMContentLoaded', () => {
    // First load the progress to ensure all tasks are properly initialized
    loadProgress().then(() => {
        // Then load and apply filters
        loadFilters();
    });
    
    document.querySelectorAll('.task').forEach(task => {
        const taskIcon = task.querySelector('.task-header i');
        
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
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(data => {
                    // Remove old assignment class
                    taskIcon.classList.remove(`assigned-${currentAssignment}`);
                    // Add new assignment class
                    taskIcon.classList.add(`assigned-${newAssignment}`);
                    
                    // Update the tooltip text with custom label if it exists
                    const label = customLabels[newAssignment.toString()] || defaultLabels[newAssignment.toString()];
                    taskIcon.setAttribute('data-assignment', label);
                })
                .catch(error => {
                    console.error('Error updating assignment:', error);
                });
        });
        
        // Existing task click handler for progress
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
            
            // Play appropriate sound(s)
            if (newProgress === 100) {
                // Add shake animation to task
                task.classList.add('task-complete-shake');
                // Remove animation class after it's done
                setTimeout(() => task.classList.remove('task-complete-shake'), 600);
                
                // Play task completion sounds
                playProgressSound();
                setTimeout(() => {
                    playCompleteSound();
                    // Check if room is complete after a short delay
                    setTimeout(() => {
                        if (isRoomComplete(floor, room)) {
                            playRoomCompleteSound();
                            // Add shake animation to room card
                            const roomCard = task.closest('.room-card');
                            if (roomCard) {
                                roomCard.classList.add('room-complete-shake');
                                // Remove animation class after it's done
                                setTimeout(() => roomCard.classList.remove('room-complete-shake'), 800);
                            }
                        }
                    }, 300);
                }, 200);
            } else if (newProgress !== 0) {
                playProgressSound();
            }
            
            updateProgress(floor, room, taskName, newProgress)
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(data => {
                    loadProgress();
                })
                .catch(error => {
                    console.error('Error updating progress:', error);
                });
        });
    });

    document.querySelectorAll('.color-filter').forEach(filter => {
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
    });

    // Add context menu event listeners
    document.querySelectorAll('.color-filter').forEach(filter => {
        filter.addEventListener('contextmenu', (e) => showContextMenu(e, filter));
    });

    // Hide context menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('#colorLabelMenu')) {
            hideContextMenu();
        }
    });

    // Handle Enter key in input
    document.getElementById('labelInput').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            applyLabel();
        } else if (e.key === 'Escape') {
            hideContextMenu();
        }
    });

    // Set initial dashboard title
    document.querySelector('.dashboard-title').textContent = dashboardTitle;

    // Add context menu for dashboard title
    document.querySelector('.dashboard-title').addEventListener('contextmenu', (e) => {
        showTitleContextMenu(e, e.target);
    });
}); 