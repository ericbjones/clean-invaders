from app import app

if __name__ == '__main__':
    # Run with WebSocket support enabled
    app.run(host='0.0.0.0', port=5000, debug=True) 