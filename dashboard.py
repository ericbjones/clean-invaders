from flask import Flask, render_template, jsonify, request, redirect
import sqlite3
import yaml
import os
from datetime import datetime

app = Flask(__name__)

def init_db():
    conn = sqlite3.connect('cleaning.db')
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room TEXT NOT NULL,
            task TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            assignment INTEGER DEFAULT 0,
            last_updated TIMESTAMP,
            floor TEXT NOT NULL
        )
    ''')
    conn.commit()
    
    # Initialize tasks from config if they don't exist
    config = load_cleaning_config()
    for floor, rooms in config.items():
        for room_name, room_data in rooms.items():
            for task in room_data['tasks']:
                c.execute('''
                    INSERT OR IGNORE INTO tasks (room, task, progress, assignment, last_updated, floor)
                    VALUES (?, ?, 0, 0, CURRENT_TIMESTAMP, ?)
                ''', (room_name, task['name'], floor))
    
    conn.commit()
    conn.close()

def load_cleaning_config():
    config = {'upstairs': {}, 'downstairs': {}}
    
    for floor in ['upstairs', 'downstairs']:
        floor_path = os.path.join('config', floor)
        for filename in os.listdir(floor_path):
            if filename.endswith('.yaml'):
                room_name = filename[:-5]
                display_name = room_name.replace('_', ' ').title()
                
                with open(os.path.join(floor_path, filename), 'r') as f:
                    config[floor][display_name] = yaml.safe_load(f)
    return config

@app.route('/')
def dashboard():
    return render_template('dashboard.html', config=load_cleaning_config())

@app.route('/api/update_progress', methods=['POST'])
def update_progress():
    data = request.json
    print(f"Received update request: {data}")  # Debug logging
    
    try:
        conn = sqlite3.connect('cleaning.db')
        c = conn.cursor()
        
        # First check if the task exists
        c.execute('''
            SELECT progress FROM tasks 
            WHERE room = ? AND task = ? AND floor = ?
        ''', (data['room'], data['task'], data['floor']))
        
        result = c.fetchone()
        if result is None:
            # Task doesn't exist, insert it
            c.execute('''
                INSERT INTO tasks (room, task, progress, last_updated, floor)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?)
            ''', (data['room'], data['task'], data['progress'], data['floor']))
        else:
            # Task exists, update it
            c.execute('''
                UPDATE tasks 
                SET progress = ?, last_updated = CURRENT_TIMESTAMP 
                WHERE room = ? AND task = ? AND floor = ?
            ''', (data['progress'], data['room'], data['task'], data['floor']))
        
        conn.commit()
        
        # Verify the update
        c.execute('''
            SELECT progress FROM tasks 
            WHERE room = ? AND task = ? AND floor = ?
        ''', (data['room'], data['task'], data['floor']))
        
        new_progress = c.fetchone()
        conn.close()
        
        return jsonify({
            'success': True,
            'progress': new_progress[0] if new_progress else None,
            'data': data
        })
        
    except Exception as e:
        print(f"Error updating progress: {str(e)}")  # Debug logging
        return jsonify({
            'success': False,
            'error': str(e),
            'data': data
        }), 500

@app.route('/api/get_progress')
def get_progress():
    conn = sqlite3.connect('cleaning.db')
    c = conn.cursor()
    c.execute('SELECT room, task, progress, floor, assignment FROM tasks')
    tasks = c.fetchall()
    conn.close()
    
    progress_data = {}
    for room, task, progress, floor, assignment in tasks:
        if floor not in progress_data:
            progress_data[floor] = {}
        if room not in progress_data[floor]:
            progress_data[floor][room] = {}
        progress_data[floor][room][task] = {
            'progress': progress,
            'assignment': assignment
        }
    
    return jsonify(progress_data)

# Add this new route to initialize or reset tasks
@app.route('/api/reset_tasks', methods=['POST'])
def reset_tasks():
    conn = sqlite3.connect('cleaning.db')
    c = conn.cursor()
    c.execute('DELETE FROM tasks')
    conn.commit()
    conn.close()
    init_db()
    return jsonify({'success': True})

@app.route('/api/reset_room', methods=['POST'])
def reset_room():
    data = request.json
    try:
        conn = sqlite3.connect('cleaning.db')
        c = conn.cursor()
        c.execute('''
            UPDATE tasks 
            SET progress = 0, last_updated = CURRENT_TIMESTAMP 
            WHERE room = ? AND floor = ?
        ''', (data['room'], data['floor']))
        conn.commit()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error resetting room: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/room/<floor>/<room>')
def room_view(floor, room):
    config = load_cleaning_config()
    if floor in config and room in config[floor]:
        room_data = config[floor][room]
        return render_template('room.html', 
                             floor=floor, 
                             room_name=room, 
                             room_data=room_data)
    return redirect('/')

@app.route('/api/update_assignment', methods=['POST'])
def update_assignment():
    data = request.json
    try:
        conn = sqlite3.connect('cleaning.db')
        c = conn.cursor()
        
        c.execute('''
            UPDATE tasks 
            SET assignment = ?, last_updated = CURRENT_TIMESTAMP 
            WHERE room = ? AND task = ? AND floor = ?
        ''', (data['assignment'], data['room'], data['task'], data['floor']))
        
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'data': data
        })
        
    except Exception as e:
        print(f"Error updating assignment: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'data': data
        }), 500

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=9000)
