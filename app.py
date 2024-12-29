from flask import Flask, render_template, jsonify, request
from flask_sock import Sock
import sqlite3
import json

app = Flask(__name__)
sock = Sock(app)

# Store active WebSocket connections
connections = set()

@sock.route('/ws')
def handle_websocket(ws):
    # Add this connection to our set
    connections.add(ws)
    try:
        while True:
            # Receive message from this client
            data = ws.receive()
            if data:
                message = json.loads(data)
                # Broadcast to all other clients
                for conn in connections:
                    if conn != ws:  # Don't send back to sender
                        try:
                            conn.send(data)
                        except:
                            connections.remove(conn)
    except:
        pass
    finally:
        # Remove connection when done
        connections.remove(ws)

# ... rest of your existing code ... 