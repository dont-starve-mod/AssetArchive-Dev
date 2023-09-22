import sys
import time
import logging
from pathlib import Path

from watchdog.observers import Observer
from watchdog.events import LoggingEventHandler

logging.basicConfig(level = logging.INFO, format = "%(asctime)s %(message)s")
event_handler = LoggingEventHandler
observer = Observer()
path = Path(__file__).resolve().parent.parent.parent
print("Watch: ", path)
observer.schedule(event_handler, path, resursive = True)
observer.start()

while True:
	time.sleep(1)
