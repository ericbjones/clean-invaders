#!/usr/bin/env python3
import subprocess
import time
import os
import sys
import logging

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(message)s',
    handlers=[
        logging.FileHandler('git_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

def run_command(command):
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        logging.error(f"Command failed: {command}")
        logging.error(f"Error: {e.stderr}")
        return None

def get_latest_commit():
    return run_command('git ls-remote origin HEAD | cut -f1')

def update_and_restart():
    logging.info("Changes detected, pulling updates...")

    # Pull changes
    if run_command('git pull') is None:
        logging.error("Failed to pull changes")
        return False

    logging.info("Successfully pulled changes")

    # Restart Flask service
    logging.info("Restarting Flask service...")
    service_path = os.path.expanduser('~/Library/LaunchAgents/com.cleaninvaders.dashboard.plist')

    if (run_command(f'launchctl unload {service_path}') is not None and
        run_command(f'launchctl load {service_path}') is not None):
        logging.info("Successfully restarted Flask service")
        return True
    else:
        logging.error("Failed to restart Flask service")
        return False

def main():
    # Change to the repository directory
    os.chdir(os.path.dirname(os.path.abspath(__file__)))

    logging.info("Starting git monitor service...")
    last_commit = get_latest_commit()

    while True:
        try:
            current_commit = get_latest_commit()

            if current_commit and current_commit != last_commit:
                logging.info(f"New commit detected: {current_commit}")
                if update_and_restart():
                    last_commit = current_commit

            time.sleep(60)  # Check every minute

        except Exception as e:
            logging.error(f"Error in main loop: {str(e)}")
            time.sleep(60)  # Wait a minute before retrying

if __name__ == '__main__':
    main()